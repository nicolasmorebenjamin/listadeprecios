const DOCUMENTO_PUBLICADO = 'https://docs.google.com/document/d/e/2PACX-1vRYuEJAWCqb3TKXHiO24XBo3ip9PX4z1EiWissi8ccsM2WUBsueH-KuU3_BX3deaoEk3_XD1dxjX-Wn/pub?embedded=true';
const CLAVE_ID_PLANILLA = 'ID_PLANILLA_PRECIOS';

/** Ejecutar una vez desde Apps Script para crear la planilla y activar el ciclo de un minuto. */
function iniciarSincronizacion() {
  const propiedades = PropertiesService.getScriptProperties();
  let idPlanilla = propiedades.getProperty(CLAVE_ID_PLANILLA);
  if (!idPlanilla) {
    const planilla = SpreadsheetApp.create('Precios sincronizados desde Google Docs');
    idPlanilla = planilla.getId();
    propiedades.setProperty(CLAVE_ID_PLANILLA, idPlanilla);
  }

  sincronizarPrecios();
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'sincronizarPrecios')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('sincronizarPrecios').timeBased().everyMinutes(1).create();
  console.log('Planilla: ' + SpreadsheetApp.openById(idPlanilla).getUrl());
}

/** Lee el documento publicado y reemplaza la tabla de precios de la planilla. */
function sincronizarPrecios() {
  const bloqueo = LockService.getScriptLock();
  if (!bloqueo.tryLock(10000)) return;

  try {
    const respuesta = UrlFetchApp.fetch(DOCUMENTO_PUBLICADO + '&_cb=' + Date.now(), {
      muteHttpExceptions: true,
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (respuesta.getResponseCode() !== 200) {
      throw new Error('Google Docs respondió ' + respuesta.getResponseCode());
    }

    const precios = extraerPrecios(respuesta.getContentText());
    const nombres = Object.keys(precios);
    if (!nombres.length) throw new Error('No se encontraron precios en el documento publicado.');

    const idPlanilla = PropertiesService.getScriptProperties().getProperty(CLAVE_ID_PLANILLA);
    if (!idPlanilla) throw new Error('Primero ejecutá iniciarSincronizacion().');
    const hoja = SpreadsheetApp.openById(idPlanilla).getSheets()[0];
    const filas = [['Producto', 'Precio'], ...nombres.map(nombre => [precios[nombre].nombre, precios[nombre].precio])];
    hoja.clearContents();
    hoja.getRange(1, 1, filas.length, 2).setValues(filas);
    hoja.setFrozenRows(1);
    hoja.autoResizeColumns(1, 2);
    PropertiesService.getScriptProperties().setProperty('ULTIMA_SINCRONIZACION', new Date().toISOString());
  } finally {
    bloqueo.releaseLock();
  }
}

/** Endpoint JSONP para que la página pública lea los precios sin un proxy externo. */
function doGet(evento) {
  const precios = leerPreciosDePlanilla();
  const json = JSON.stringify(precios);
  const callback = evento && evento.parameter && evento.parameter.callback;
  if (callback && /^[A-Za-z_$][\w$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function leerPreciosDePlanilla() {
  const idPlanilla = PropertiesService.getScriptProperties().getProperty(CLAVE_ID_PLANILLA);
  if (!idPlanilla) return {};
  const hoja = SpreadsheetApp.openById(idPlanilla).getSheets()[0];
  const datos = hoja.getDataRange().getValues();
  const precios = {};
  datos.slice(1).forEach(([nombre, precio]) => {
    if (nombre && precio !== '' && Number.isFinite(Number(precio))) {
      precios[normalizar(nombre)] = Number(precio);
    }
  });
  return precios;
}

function extraerPrecios(html) {
  const precios = {};
  const filas = html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const [, fila] of filas) {
    const celdas = [...fila.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
      .map(([, celda]) => textoPlano(celda));
    for (let i = 0; i < celdas.length - 1; i++) {
      const nombre = celdas[i];
      const coincidencia = celdas[i + 1].match(/^\s*\$\s*([\d.,]+)/);
      if (!nombre || !coincidencia) continue;
      const precio = Number(coincidencia[1].replace(/\D/g, ''));
      if (Number.isFinite(precio)) precios[normalizar(nombre)] = { nombre, precio };
    }
  }
  return precios;
}

function textoPlano(html) {
  return html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, ' ').trim();
}

function normalizar(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}
