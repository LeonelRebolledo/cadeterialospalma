const { jsPDF } = window.jspdf;

const state = {
  currentLocation: null,
  entries: [],
  stopNumber: 1,
};

const companyInput = document.getElementById("company");
const form = document.getElementById("deliveryForm");
const locationButton = document.getElementById("locationButton");
const locationStatus = document.getElementById("locationStatus");
const locationSummary = document.getElementById("locationSummary");
const entryCounter = document.getElementById("entryCounter");
const summaryCount = document.getElementById("summaryCount");
const entriesList = document.getElementById("entriesList");
const productImageInput = document.getElementById("productImage");
const remitoImageInput = document.getElementById("remitoImage");
const productPreview = document.getElementById("productPreview");
const remitoPreview = document.getElementById("remitoPreview");
const productState = document.getElementById("productState");
const remitoState = document.getElementById("remitoState");
const nextButton = document.getElementById("nextButton");

companyInput.addEventListener("input", () => {
  companyInput.value = companyInput.value.toUpperCase();
});

locationButton.addEventListener("click", requestLocation);
productImageInput.addEventListener("change", (event) => handleImageChange(event, productPreview, productState));
remitoImageInput.addEventListener("change", (event) => handleImageChange(event, remitoPreview, remitoState));
nextButton.addEventListener("click", () => {
  saveCurrentEntry();
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const stored = await saveCurrentEntry();
  if (!stored && state.entries.length === 0) {
    alert("Completa al menos una parada antes de generar el PDF.");
    return;
  }

  await generatePdf();
});

updateEntryCounter();
renderEntries();

async function requestLocation() {
  if (!("geolocation" in navigator)) {
    locationStatus.textContent = "Geolocalizacion no disponible";
    locationSummary.textContent = "Este dispositivo o navegador no permite obtener la ubicacion.";
    return;
  }

  locationStatus.textContent = "Buscando ubicacion...";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      let address = "Ubicacion detectada";

      try {
        address = await reverseGeocode(latitude, longitude);
      } catch (error) {
        address = "No se pudo obtener la direccion exacta";
      }

      state.currentLocation = {
        latitude,
        longitude,
        address,
        timestamp: new Date().toISOString(),
      };

      locationStatus.textContent = "Ubicacion lista";
      locationSummary.textContent = `${address}. Coordenadas ${latitude.toFixed(5)}, ${longitude.toFixed(5)}.`;
    },
    (error) => {
      const messageMap = {
        1: "Permiso denegado para la ubicacion.",
        2: "No se pudo determinar la ubicacion.",
        3: "Tiempo agotado al pedir la ubicacion.",
      };

      locationStatus.textContent = "Ubicacion no disponible";
      locationSummary.textContent = messageMap[error.code] || "Ocurrio un error al obtener la ubicacion.";
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

async function reverseGeocode(latitude, longitude) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
  );

  if (!response.ok) {
    throw new Error("Reverse geocoding failed");
  }

  const data = await response.json();
  return data.display_name || "Ubicacion detectada";
}

function handleImageChange(event, previewElement, stateElement) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    previewElement.src = reader.result;
    previewElement.parentElement.classList.add("has-image");
    stateElement.textContent = "Foto cargada";
  };
  reader.readAsDataURL(file);
}

async function saveCurrentEntry() {
  const company = companyInput.value.trim().toUpperCase();
  const deliveryType = form.elements.deliveryType.value;
  const productImage = productPreview.src || "";
  const remitoImage = remitoPreview.src || "";

  if (!company) {
    companyInput.focus();
    alert("Ingresa la empresa para continuar.");
    return false;
  }

  if (!productImage || !remitoImage) {
    alert("Debes tomar una foto de PRODUCTO y una de REMITO.");
    return false;
  }

  const capturedAt = new Date();
  const location = state.currentLocation
    ? { ...state.currentLocation, timestamp: capturedAt.toISOString() }
    : {
        latitude: null,
        longitude: null,
        address: "Ubicacion no informada",
        timestamp: capturedAt.toISOString(),
      };

  state.entries.push({
    company,
    deliveryType,
    productImage,
    remitoImage,
    location,
    dateLabel: formatDate(capturedAt),
    timeLabel: formatTime(capturedAt),
    stopNumber: state.stopNumber,
  });

  state.stopNumber += 1;
  renderEntries();
  updateEntryCounter();
  resetForm();

  try {
    await requestFreshLocationSilently();
  } catch (error) {
    // Keep existing flow even if the new location cannot be refreshed.
  }

  return true;
}

function requestFreshLocationSilently() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let address = "Ubicacion detectada";
        try {
          address = await reverseGeocode(latitude, longitude);
        } catch (error) {
          address = "No se pudo obtener la direccion exacta";
        }

        state.currentLocation = {
          latitude,
          longitude,
          address,
          timestamp: new Date().toISOString(),
        };
        locationStatus.textContent = "Ubicacion actualizada";
        locationSummary.textContent = `${address}. Coordenadas ${latitude.toFixed(5)}, ${longitude.toFixed(5)}.`;
        resolve();
      },
      reject,
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      }
    );
  });
}

function resetForm() {
  form.reset();
  companyInput.value = "";
  productPreview.src = "";
  remitoPreview.src = "";
  productPreview.parentElement.classList.remove("has-image");
  remitoPreview.parentElement.classList.remove("has-image");
  productState.textContent = "Sin foto";
  remitoState.textContent = "Sin foto";
}

function renderEntries() {
  summaryCount.textContent = `${state.entries.length} guardadas`;

  if (state.entries.length === 0) {
    entriesList.innerHTML = '<p class="empty-state">Todavia no hay paradas guardadas.</p>';
    return;
  }

  entriesList.innerHTML = state.entries
    .map(
      (entry) => `
        <article class="entry-item">
          <strong>Parada ${entry.stopNumber}: ${escapeHtml(entry.company)}</strong>
          <p class="entry-meta">${entry.deliveryType} · ${entry.dateLabel} · ${entry.timeLabel}</p>
          <p class="entry-meta">${escapeHtml(entry.location.address)}</p>
        </article>
      `
    )
    .join("");
}

function updateEntryCounter() {
  entryCounter.textContent = `Parada ${state.stopNumber}`;
}

async function generatePdf() {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const generatedAt = new Date();
  const mainLocation = state.entries[state.entries.length - 1]?.location?.address || "Ubicacion no informada";

  drawCover(doc, {
    date: formatDate(generatedAt),
    time: formatTime(generatedAt),
    location: mainLocation,
    totalEntries: state.entries.length,
  });

  for (let index = 0; index < state.entries.length; index += 1) {
    const entry = state.entries[index];
    doc.addPage();
    await drawEntryPage(doc, entry, index + 1);
  }

  doc.save(buildFileName(generatedAt));
}

function drawCover(doc, context) {
  doc.setFillColor(240, 247, 243);
  doc.rect(0, 0, 210, 297, "F");

  doc.setFillColor(15, 140, 107);
  doc.roundedRect(14, 14, 182, 40, 8, 8, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("CADETERIA LOS PALMAS", 20, 31);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Resumen operativo de entregas y despachos", 20, 40);

  doc.setTextColor(24, 33, 29);
  doc.setFillColor(255, 253, 248);
  doc.roundedRect(14, 62, 182, 78, 8, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Estimado proveedor:", 20, 79);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  const summaryText =
    "Aqui el resumen de su entrega con sus correspondientes remitos. El siguiente documento fue generado desde la app movil de ruteo para registrar cada parada con fotos, fecha, horario y lugar.";
  const wrapped = doc.splitTextToSize(summaryText, 166);
  doc.text(wrapped, 20, 92);

  doc.setDrawColor(15, 140, 107);
  doc.setLineWidth(0.7);
  doc.roundedRect(14, 150, 182, 88, 8, 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Detalle general", 20, 165);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const details = [
    `Fecha: ${context.date}`,
    `Horario: ${context.time}`,
    `Lugar: ${context.location}`,
    `Total de paradas registradas: ${context.totalEntries}`,
  ];

  let lineY = 180;
  details.forEach((detail) => {
    const lines = doc.splitTextToSize(detail, 165);
    doc.text(lines, 20, lineY);
    lineY += lines.length * 6 + 4;
  });

  doc.setFontSize(10);
  doc.setTextColor(82, 97, 92);
  doc.text("Documento generado automaticamente para uso operativo en celular.", 20, 277);
}

async function drawEntryPage(doc, entry, pageNumber) {
  doc.setFillColor(252, 249, 244);
  doc.rect(0, 0, 210, 297, "F");

  doc.setFillColor(15, 140, 107);
  doc.roundedRect(14, 14, 182, 22, 7, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Parada ${pageNumber} · ${entry.deliveryType}`, 20, 28);

  doc.setTextColor(24, 33, 29);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 46, 182, 76, 7, 7, "F");

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Empresa", 20, 60);
  doc.setFont("helvetica", "normal");
  doc.text(entry.company, 20, 69);

  doc.setFont("helvetica", "bold");
  doc.text("Fecha", 20, 84);
  doc.setFont("helvetica", "normal");
  doc.text(entry.dateLabel, 20, 93);

  doc.setFont("helvetica", "bold");
  doc.text("Horario", 110, 84);
  doc.setFont("helvetica", "normal");
  doc.text(entry.timeLabel, 110, 93);

  doc.setFont("helvetica", "bold");
  doc.text("Ubicacion", 20, 108);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(entry.location.address, 166), 20, 117);

  doc.setFont("helvetica", "bold");
  doc.text("Producto", 20, 144);
  doc.text("Remito", 110, 144);

  if (entry.productImage) {
    addImageSafe(doc, entry.productImage, 20, 150, 76, 96);
  }
  if (entry.remitoImage) {
    addImageSafe(doc, entry.remitoImage, 110, 150, 76, 96);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(82, 97, 92);
  doc.text("Registro visual de la parada y su correspondiente remito.", 20, 264);
}

function addImageSafe(doc, imageData, x, y, width, height) {
  try {
    const format = imageData.startsWith("data:image/png") ? "PNG" : "JPEG";
    doc.addImage(imageData, format, x, y, width, height, undefined, "MEDIUM");
  } catch (error) {
    doc.setDrawColor(213, 132, 46);
    doc.rect(x, y, width, height);
    doc.setFontSize(10);
    doc.setTextColor(213, 132, 46);
    doc.text("No se pudo incrustar la imagen", x + 5, y + 10);
  }
}

function buildFileName(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `CADETERIA_LOS_PALMAS_${year}${month}${day}_${hours}${minutes}.pdf`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
