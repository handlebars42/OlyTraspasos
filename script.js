"use strict;"

/*
 * Oly-Traspasos
 *
 * Aplicación móvil para hacer traspasos de mercancías entre tiendas, ambas usando MyBusiness POS
 * Luis Mendoza Copyright (c) 2023
 *
 */

const app = {
  archivoEnMemoria: false,
  
  datos: [],
  lista: [],
}

window.onload = function() {
  console.log("Iniciando app OlyTraspasos");
  
  let datos = localStorage.getItem("oly-datos")
  if (datos) {
    app.datos = JSON.parse(datos);
    byId("xlcargado").show()
    byId("xlcargado").innerHTML = "<br>Ya hay datos cargados. Si elige otro archivo, se borrarán los datos anteriores";

    app.archivoEnMemoria=true
    byId("msg-loaded").textContent=""
  } else {
    byId("msg-loaded").textContent="NO HAY ARCHIVO EN MEMORIA"
  }
  
  let lista = localStorage.getItem("oly-lista")
  if (lista) {
    app.lista = JSON.parse(lista)
  }
}

function onCargar() {
  console.log("Clic en cargar")
  mostrarPagina("cargar")
}

function onRegistrar() {
  console.log("Clic en registrar")
  mostrarPagina("registrar")
}

function onDescargar() {
  console.log("Clic en descargar")
  mostrarPagina("descargar")
}

function onInfo() {
  console.log("Clic en info")
  mostrarPagina("info")
}

async function onExcelSelected(event) {
  console.log("Archivo seleccionado");
  
  byId("xlcargado").innerHTML = `<br><p style="color:red;">Procesando. Por favor espere...</p>`;
  let file = byId("excel").files[0];
  if (!file) return;
  
  let wb = new ExcelJS.Workbook();
  let buffer = await file.arrayBuffer();
  let workbook = await wb.xlsx.load(buffer)
  
  console.log("Excel cargado")
  console.log(workbook)
  
  app.datos=[]
  
  let codigos = workbook.worksheets[0].columns[0].values;
  let descripciones = workbook.worksheets[0].columns[1].values;
  
  for (let i=2; i<codigos.length; i++) {
    app.datos.push({
      codigo: codigos[i],
      descripcion: descripciones[i],
      
      paraBuscar: (codigos[i] + " " + descripciones[i]).toLowerCase(),
    })
  }

  byId("xlcargado").innerHTML = "<br>El archivo Excel ha sido cargado. Puede continuar con el registro de productos para transferir";
  
  app.lista = []
  app.archivoEnMemoria = true
  
  localStorage.setItem("oly-datos", JSON.stringify(app.datos))
  localStorage.setItem("oly-lista", JSON.stringify(app.lista))

  byId("msg-loaded").textContent = ""
}

function onBusqueda() {
  if (byId("busqueda").length == 0) {
    byId("encontrados").innerHTML = ""
    return;
  }
  
  let buscar = byId("busqueda").value.toLowerCase().split(" ")
  let encontrados = app.datos.filter(rec => 
    buscar.reduce((acc, i) => acc && rec.paraBuscar.indexOf(i) >= 0, true))
                                     
  console.log(encontrados)
  
  if (encontrados.length==1) {
    onMostrarArticulo(encontrados[0].codigo)
    return
  }

  let html = "<br>"
  
  for (let i= 0; i < encontrados.length && i < 20; i++) {
    html += `<strong><a href="javascript:void(0)" onclick="onMostrarArticulo('${encontrados[i].codigo}')">${encontrados[i].descripcion}</a><hr></strong>`
  }
  
  if (encontrados.length > 20) {
    html += "<em>Demasiados resultados; refine la b&uacute;squeda por favor.</em>"
  }
  
  byId("encontrados").innerHTML = html
}

var barcodeStat = {
  stream: undefined,
  intervalId: undefined,
}

let barcodeDetectionTimer = null;
let barcodeDetectionInProgress = false;

function onBarcode() {
  mostrarPagina("barcode");
  
  navigator.mediaDevices.getUserMedia({
    audio: 0,
    video: {
        facingMode: {
            ideal: "environment"
        },
      width: { ideal: 390 },
      height: { ideal: 219 }
    }
  }).then(stream => {
    const bar = document.getElementById('bar');
    bar.srcObject = stream;
    
    const redline = byId('red-line')
    redline.style.top = "-" + ((bar.offsetHeight/2)-2) + "px";
    redline.style.left = (bar.offsetWidth/4) + "px";
    redline.style.width = ((bar.offsetWidth/4) *2) + "px";
    
    bar.addEventListener('play', () => {
      capturarBarcode()
    })
 })

  return
}

function stopBarcodeCamera() {
  if (barcodeDetectionTimer) {
    clearInterval(barcodeDetectionTimer);
    barcodeDetectionTimer = null;
  }

  barcodeDetectionInProgress = false;

  const video = document.getElementById("bar");
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
}

function preprocessBarcodeFrame(sourceCanvas) {
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = sourceCanvas.width;
  outputCanvas.height = sourceCanvas.height;

  const sourceContext = sourceCanvas.getContext("2d", {
    willReadFrequently: true
  });
  const outputContext = outputCanvas.getContext("2d", {
    willReadFrequently: true
  });

  const image = sourceContext.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height
  );

  const pixels = image.data;
  const contrast = 1.35;
  const contrastOffset = 128 * (1 - contrast);

  // Grayscale and contrast enhancement
  for (let index = 0; index < pixels.length; index += 4) {
    const gray =
      pixels[index] * 0.299 +
      pixels[index + 1] * 0.587 +
      pixels[index + 2] * 0.114;

    const enhanced = Math.max(
      0,
      Math.min(255, gray * contrast + contrastOffset)
    );

    pixels[index] = enhanced;
    pixels[index + 1] = enhanced;
    pixels[index + 2] = enhanced;
  }

  sourceContext.putImageData(image, 0, 0);

  // Mild sharpening
  outputContext.filter = "contrast(115%)";
  outputContext.drawImage(sourceCanvas, 0, 0);

  return outputCanvas;
}

function capturarBarcode() {
  console.log("Click en capturar barcode")

  const video = document.getElementById("bar");
  const canvas = document.getElementById("canvas1");

   if (!video.videoWidth || !video.videoHeight) {
    alert("La camara aun no esta lista");
    return;
  }

  const cropWidth = Math.floor(video.videoWidth / 2);
  const cropHeight = Math.min(240, video.videoHeight);
  const cropX = Math.floor((video.videoWidth - cropWidth) / 2);
  const cropY = Math.floor((video.videoHeight - cropHeight) / 2);

  canvas.width = cropWidth;
  canvas.height = cropHeight;

  const context = canvas.getContext("2d");

  if (!("BarcodeDetector" in window)) {
    alert("Este navegador no soporta BarcodeDetector");
    return;
  }

  const detector = new BarcodeDetector({
    formats: ["ean_13", "code_39", "code_128",
      "ean_8", "upc_a", "upc_e", "codabar", "itf"
    ]
  });

  if (barcodeDetectionTimer) {
    return;
  }

  const detectFrame = () => {
    if (barcodeDetectionInProgress || !video.videoWidth || !video.videoHeight) {
      return;
    }

    barcodeDetectionInProgress = true;

    context.drawImage(
      video,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    const processedFrame = preprocessBarcodeFrame(canvas);

    detector.detect(processedFrame)
      .then(detections => {
        const result = detections.find(detection => {
          const value = detection.rawValue || detection.rawData;
          return typeof value === "string" && value.trim().length > 0;
        });

        if (!result) {
          return;
        }

        const barcode = result.rawValue || result.rawData;
        stopBarcodeCamera();

        const barcodeInput = document.getElementById("busqueda");
        barcodeInput.value = barcode;
        barcodeInput.dispatchEvent(new Event("input"));
        mostrarPagina("registrar")
      })
      .catch(error => {
        console.error("Error detectando codigo:", error);
      })
      .finally(() => {
        barcodeDetectionInProgress = false;
      });
  };

  detectFrame();
  barcodeDetectionTimer = setInterval(detectFrame, 150);

  return
}

function cancelarBarcode() {
  stopBarcodeCamera();

  onRegistrar()
}

function onMostrarArticulo(codigo) {
  mostrarPagina("articulo")
  
  let articulo = app.datos.find(a => a.codigo == codigo)
  if (!articulo) {
    byId("codigo").innerHTML = `<strong><span style="color:red;">No se encontr&oacute; el art&iacute;culo con c&oacute;digo: ${codigo}</span></strong>`
    return
  }
  
  byId("codigo").innerHTML = `<strong>${articulo.codigo}</strong>`
  byId("descripcion").innerHTML = `<strong>${articulo.descripcion}</strong>`
  byId("cantidad").value = 0
}

function onCancelar() {
  mostrarPagina("registrar")
}

function onGuardar() {
  app.lista.push({
    codigo: byId("codigo").innerText,
    descripcion: byId("descripcion").innerText,
    cantidad: isNaN(parseInt(byId("cantidad").value)) ? 0 : parseInt(byId("cantidad").value),
  })
  
  app.lista.sort((a, b) => {
    return a.descripcion.localeCompare(b.descripcion)
  })
  
  localStorage.setItem("oly-lista", JSON.stringify(app.lista))
  
  byId("busqueda").value = ""
  mostrarPagina("registrar")
  byId("busqueda").focus()
}

function descargarExcel(filename="export.xlsx") {
  let wb = new ExcelJS.Workbook()
  let ws = wb.addWorksheet("Sheet1")

  ws.addRow(["Código", "Descripción", "Cantidad"])
  ws.columns[2].alignment = {horizontal:'right'} //A row is needed before adjusting alignment
  app.lista.forEach(function (row) {
    if (row.cantidad > 0) {
      ws.addRow([row.codigo, row.descripcion, row.cantidad])
    }
  })

  wb.xlsx.writeBuffer().then(function (data) {
    let blob = new Blob([data], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})
    downloadBlob(blob, filename);
  })
  
  app.archivoEnMemoria = false
  app.datos = []
  app.lista = []
  
  localStorage.removeItem("oly-datos")
  localStorage.removeItem("oly-lista")

  byId("excel").value=null
  byId("msg-loaded").textContent="NO HAY ARCHIVO EN MEMORIA"
  byId("xlcargado").hide()
  byId("encontrados").innerHTML = ""
}

/*
 * Funciones útiles
 */

function mostrarPagina(pagina) {
  if (app.pagina_actual) app.pagina_actual.hide()
  
  app.pagina_actual = byId(pagina)
  app.pagina_actual.show()
}

function byId(id) {
  return document.getElementById(id)
}

HTMLElement.prototype.show = function() {
  this.style.display = "block";
}

HTMLElement.prototype.hide = function() {
  this.style.display = "none";
}

function downloadBlob(blob, name = 'file.txt') {
  // Convert your blob into a Blob URL (a special url that points to an object in the browser's memory)
  const blobUrl = URL.createObjectURL(blob);

  // Create a link element
  const link = document.createElement("a");

  // Set link's href to point to the Blob URL
  link.href = blobUrl;
  link.download = name;

  // Append link to the body
  document.body.appendChild(link);

  // Dispatch click event on the link
  // This is necessary as link.click() does not work on the latest firefox
  link.dispatchEvent(
    new MouseEvent('click', { 
      bubbles: true, 
      cancelable: true, 
      view: window 
    })
  );

  // Remove link from body
  document.body.removeChild(link);
}


