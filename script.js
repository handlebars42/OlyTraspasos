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

function onBarcode() {
  mostrarPagina("barcode");
  
  navigator.mediaDevices.getUserMedia({
    audio: 0,
    video: {
        facingMode: {
            ideal: "environment"
        },
      zoom: true,
    }
  }).then(stream => {
    barcodeStat.stream = stream;

    const bar = document.getElementById('bar');
    bar.srcObject = stream;
    
    const redline = byId('red-line')
    redline.style.top = "-" + ((bar.offsetHeight/2)-2) + "px";
    redline.style.left = (bar.offsetWidth/4) + "px";
    redline.style.width = ((bar.offsetWidth/4) *2) + "px";
    
    const img = byId("input")
    img.onload = function() {
      console.log("image loaded")
      if ('BarcodeDetector' in window) {
        const detector = new BarcodeDetector({formats:["ean_13", "code_39", "code_128"]});
        detector.detect(input).then(detections => {
          if (detections.length == 0) {
            alert("No se pudo leer el codigo")
            return
          }

          detections.forEach(detected => {
            let result = detected.rawValue||detected.rawData
            //alert(result);

            bar.srcObject.getTracks().forEach(function(track) {
              track.stop();
            }); // Camera stop

            onMostrarArticulo(result)
          })
        })
      }
    }
  })
}

function capturarBarcode() {
  console.log("Click en capturar barcode")
  const bar = byId('bar')
  const canvas = byId('canvas1');
  const redline = byId("red-line")
  const input = byId('input');

  const quarter = bar.videoWidth / 4
  
  canvas.width = quarter*2;
  canvas.height = 200;//bar.videoHeight;
  const ctx = canvas.getContext('2d');
  
  ctx.drawImage(bar, quarter, (bar.videoHeight/2)-100, quarter *2, 200,
               0, 0, quarter*2, 200);
  
  
    
  /*canvas.width = bar.videoWidth;
  canvas.height = bar.videoHeight;
  const ctx = canvas.getContext('2d');
  
  ctx.drawImage(bar, 0, 0);*/
  
  input.src = canvas.toDataURL();
  // Now, the onload event for the img will be fired
}

function cancelarBarcode() {
  barcodeStat.stream.getTracks().forEach(track => track.stop());
  
  barcodeStat.stream = undefined
  barcodeStat.intervalId = undefined
  
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
  
  byId("excel").value=null
  app.archivoEnMemoria = false
  app.datos = []
  app.lista = []
  
  localStorage.removeItem("oly-datos")
  localStorage.removeItem("oly-lista")

  byId("msg-loaded").textContent="NO HAY ARCHIVO EN MEMORIA"
  byId("xlcargado").hide()
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
