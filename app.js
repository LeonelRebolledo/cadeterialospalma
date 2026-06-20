const { jsPDF } = window.jspdf;
const STORAGE_KEY = "cadeteria-los-palma-state";

const captureFields = [
  {
    key: "documentImage",
    inputId: "documentImage",
    previewId: "documentPreview",
    stateId: "documentState",
    label: "DOCUMENTO",
    required: true,
  },
  {
    key: "image1",
    inputId: "image1",
    previewId: "image1Preview",
    stateId: "image1State",
    label: "IMAGEN 1",
    required: true,
  },
  {
    key: "image2",
    inputId: "image2",
    previewId: "image2Preview",
    stateId: "image2State",
    label: "IMAGEN 2",
    required: false,
  },
  {
    key: "image3",
    inputId: "image3",
    previewId: "image3Preview",
    stateId: "image3State",
    label: "IMAGEN 3",
    required: false,
  },
  {
    key: "image4",
    inputId: "image4",
    previewId: "image4Preview",
    stateId: "image4State",
    label: "IMAGEN 4",
    required: false,
  },
];

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
const nextButton = document.getElementById("nextButton");
const partnerHeroImage = document.getElementById("partnerHeroImage");
const resetButton = document.getElementById("resetButton");
const resetModal = document.getElementById("resetModal");
const cancelResetButton = document.getElementById("cancelResetButton");
const confirmResetButton = document.getElementById("confirmResetButton");
const toastMessage = document.getElementById("toastMessage");

const captureElements = captureFields.map((field) => ({
  ...field,
  input: document.getElementById(field.inputId),
  preview: document.getElementById(field.previewId),
  stateLabel: document.getElementById(field.stateId),
}));

companyInput.addEventListener("input", () => {
  companyInput.value = companyInput.value.toUpperCase();
  persistAppState();
});

locationButton.addEventListener("click", requestLocation);
nextButton.addEventListener("click", () => {
  saveCurrentEntry();
});
resetButton.addEventListener("click", openResetModal);
cancelResetButton.addEventListener("click", handleContinueEditing);
confirmResetButton.addEventListener("click", handleConfirmReset);
resetModal.addEventListener("click", (event) => {
  if (event.target === resetModal) {
    closeResetModal();
  }
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

captureElements.forEach((field) => {
  field.input.addEventListener("change", (event) => {
    handleImageChange(event, field.preview, field.stateLabel, field.required);
  });
});

form.elements.deliveryType.forEach((radio) => {
  radio.addEventListener("change", persistAppState);
});

restoreAppState();
updateEntryCounter();
renderEntries();
renderLocationState();

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

      renderLocationState();
      persistAppState();
    },
    (error) => {
      const messageMap = {
        1: "Permiso denegado para la ubicacion.",
        2: "No se pudo determinar la ubicacion.",
        3: "Tiempo agotado al pedir la ubicacion.",
      };

      locationStatus.textContent = "Ubicacion no disponible";
      locationSummary.textContent = messageMap[error.code] || "Ocurrio un error al obtener la ubicacion.";
      persistAppState();
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

function handleImageChange(event, previewElement, stateElement, required) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    previewElement.src = reader.result;
    previewElement.parentElement.classList.add("has-image");
    stateElement.textContent = required ? "Listo" : "Cargada";
    persistAppState();
  };
  reader.readAsDataURL(file);
}

async function saveCurrentEntry() {
  const company = companyInput.value.trim().toUpperCase();
  const deliveryType = form.elements.deliveryType.value;
  const captures = getCaptureData();

  if (!company) {
    companyInput.focus();
    alert("Ingresa la empresa para continuar.");
    return false;
  }

  const missingRequired = captureElements.filter((field) => field.required && !captures[field.key]);
  if (missingRequired.length > 0) {
    alert("Debes cargar el DOCUMENTO y la IMAGEN 1 para guardar la parada.");
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

  const imageCount = Object.values(captures).filter(Boolean).length;

  state.entries.push({
    company,
    deliveryType,
    captures,
    location,
    dateLabel: formatDate(capturedAt),
    timeLabel: formatTime(capturedAt),
    stopNumber: state.stopNumber,
    imageCount,
  });

  state.stopNumber += 1;
  renderEntries();
  updateEntryCounter();
  resetForm();
  persistAppState();

  try {
    await requestFreshLocationSilently();
  } catch (error) {
    // Keep the flow moving if location cannot be refreshed.
  }

  return true;
}

function getCaptureData() {
  return captureElements.reduce((accumulator, field) => {
    accumulator[field.key] = field.preview.src || "";
    return accumulator;
  }, {});
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

        renderLocationState("Ubicacion actualizada");
        persistAppState();
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

  captureElements.forEach((field) => {
    field.preview.src = "";
    field.preview.parentElement.classList.remove("has-image");
    field.stateLabel.textContent = field.required ? "Sin foto" : "Opcional";
  });

  persistAppState();
}

function openResetModal() {
  resetModal.hidden = false;
}

function closeResetModal() {
  resetModal.hidden = true;
}

function handleContinueEditing(event) {
  event.preventDefault();
  closeResetModal();
}

function handleConfirmReset(event) {
  event.preventDefault();
  resetAllData();
}

function resetAllData() {
  state.entries = [];
  state.stopNumber = 1;
  state.currentLocation = null;

  closeResetModal();
  resetForm();
  renderEntries();
  updateEntryCounter();
  renderLocationState();
  clearPersistedState();

  showToast("Cargar nueva solicitud");
}

function showToast(message) {
  toastMessage.textContent = message;
  toastMessage.hidden = false;
  toastMessage.classList.remove("show");

  // Restart animation cleanly each time the toast is shown.
  void toastMessage.offsetWidth;

  toastMessage.classList.add("show");

  window.setTimeout(() => {
    toastMessage.classList.remove("show");
    toastMessage.hidden = true;
  }, 1700);
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
          <p class="entry-meta">${entry.deliveryType} - ${entry.dateLabel} - ${entry.timeLabel}</p>
          <p class="entry-meta">${escapeHtml(entry.location.address)}</p>
          <p class="entry-meta">${entry.imageCount} archivo(s) cargado(s)</p>
        </article>
      `
    )
    .join("");
}

function updateEntryCounter() {
  entryCounter.textContent = `Parada ${state.stopNumber}`;
}

function renderLocationState(statusText = "Ubicacion pendiente") {
  if (!state.currentLocation) {
    locationStatus.textContent = statusText;
    locationSummary.textContent = "Todavia no se otorgo permiso de ubicacion.";
    return;
  }

  const { address, latitude, longitude } = state.currentLocation;
  locationStatus.textContent = statusText === "Ubicacion pendiente" ? "Ubicacion lista" : statusText;
  locationSummary.textContent = `${address}. Coordenadas ${latitude.toFixed(5)}, ${longitude.toFixed(5)}.`;
}

function persistAppState() {
  const payload = {
    entries: state.entries,
    stopNumber: state.stopNumber,
    currentLocation: state.currentLocation,
    draft: {
      company: companyInput.value.trim().toUpperCase(),
      deliveryType: form.elements.deliveryType.value,
      captures: getCaptureData(),
    },
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Ignore storage failures and keep the app usable.
  }
}

function restoreAppState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const saved = JSON.parse(raw);
    state.entries = Array.isArray(saved.entries) ? saved.entries : [];
    state.stopNumber = Number.isInteger(saved.stopNumber) && saved.stopNumber > 0 ? saved.stopNumber : 1;
    state.currentLocation = saved.currentLocation || null;

    if (saved.draft) {
      companyInput.value = typeof saved.draft.company === "string" ? saved.draft.company : "";
      setDeliveryType(saved.draft.deliveryType);
      restoreDraftCaptures(saved.draft.captures || {});
    }

    if (state.entries.length > 0 || companyInput.value || hasDraftCaptures()) {
      showToast("Se recupero la ultima carga");
    }
  } catch (error) {
    clearPersistedState();
  }
}

function restoreDraftCaptures(captures) {
  captureElements.forEach((field) => {
    const imageData = captures[field.key] || "";
    field.preview.src = imageData;
    field.preview.parentElement.classList.toggle("has-image", Boolean(imageData));
    field.stateLabel.textContent = imageData ? (field.required ? "Listo" : "Cargada") : (field.required ? "Sin foto" : "Opcional");
  });
}

function hasDraftCaptures() {
  return captureElements.some((field) => Boolean(field.preview.src));
}

function setDeliveryType(value) {
  const selected = value === "ENTREGA" ? "ENTREGA" : "DESPACHO";
  const radio = form.querySelector(`input[name="deliveryType"][value="${selected}"]`);
  if (radio) {
    radio.checked = true;
  }
}

function clearPersistedState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // Ignore storage cleanup failures.
  }
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
    doc.addPage();
    drawEntryPage(doc, state.entries[index], index + 1);
  }

  doc.save(buildFileName(generatedAt));
}

function drawCover(doc, context) {
  doc.setFillColor(240, 247, 243);
  doc.rect(0, 0, 210, 297, "F");

  doc.setFillColor(15, 140, 107);
  doc.roundedRect(14, 14, 182, 42, 8, 8, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("CADETERIA LOS PALMA", 20, 31);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Resumen operativo de entregas y despachos", 20, 41);

  doc.setFillColor(255, 253, 248);
  doc.roundedRect(14, 66, 182, 74, 8, 8, "F");
  doc.setTextColor(24, 33, 29);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Estimado proveedor:", 20, 81);

  addPartnerCoverImage(doc);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  const summaryText =
    "Aqui el resumen de su entrega con sus correspondientes remitos. El documento fue generado desde la app movil para registrar cada parada con documento, imagenes, fecha, horario y lugar.";
  doc.text(doc.splitTextToSize(summaryText, 92), 20, 94);

  doc.setDrawColor(15, 140, 107);
  doc.setLineWidth(0.7);
  doc.roundedRect(14, 152, 182, 88, 8, 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Detalle general", 20, 167);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const details = [
    `Fecha: ${context.date}`,
    `Horario: ${context.time}`,
    `Lugar: ${context.location}`,
    `Total de paradas registradas: ${context.totalEntries}`,
  ];

  let lineY = 182;
  details.forEach((detail) => {
    const lines = doc.splitTextToSize(detail, 165);
    doc.text(lines, 20, lineY);
    lineY += lines.length * 6 + 4;
  });

  doc.setFontSize(10);
  doc.setTextColor(82, 97, 92);
  doc.text("Documento generado automaticamente para uso operativo en celular.", 20, 277);
}

function addPartnerCoverImage(doc) {
  if (!partnerHeroImage || !partnerHeroImage.complete) {
    return;
  }

  try {
    doc.addImage(partnerHeroImage, "PNG", 118, 75, 60, 36, undefined, "MEDIUM");
  } catch (error) {
    // Skip the decorative image if the browser cannot serialize it.
  }
}

function drawEntryPage(doc, entry, pageNumber) {
  doc.setFillColor(252, 249, 244);
  doc.rect(0, 0, 210, 297, "F");

  doc.setFillColor(15, 140, 107);
  doc.roundedRect(14, 14, 182, 22, 7, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Parada ${pageNumber} - ${entry.deliveryType}`, 20, 28);

  doc.setTextColor(24, 33, 29);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 46, 182, 58, 7, 7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Empresa", 20, 60);
  doc.setFont("helvetica", "normal");
  doc.text(entry.company, 20, 69);

  doc.setFont("helvetica", "bold");
  doc.text("Fecha", 20, 83);
  doc.setFont("helvetica", "normal");
  doc.text(entry.dateLabel, 20, 92);

  doc.setFont("helvetica", "bold");
  doc.text("Horario", 106, 83);
  doc.setFont("helvetica", "normal");
  doc.text(entry.timeLabel, 106, 92);

  doc.setFont("helvetica", "bold");
  doc.text("Ubicacion", 20, 106);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(entry.location.address, 164), 20, 115);

  const captureBlocks = buildCaptureBlocks(entry);
  const positions = [
    { x: 14, y: 126, width: 86, height: 68 },
    { x: 110, y: 126, width: 86, height: 68 },
    { x: 14, y: 202, width: 56, height: 56 },
    { x: 77, y: 202, width: 56, height: 56 },
    { x: 140, y: 202, width: 56, height: 56 },
  ];

  captureBlocks.forEach((block, index) => {
    drawCaptureBlock(doc, block, positions[index]);
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(82, 97, 92);
  doc.text("Documento obligatorio e imagenes registradas para esta parada.", 20, 274);
}

function buildCaptureBlocks(entry) {
  const captureOrder = [
    { label: "DOCUMENTO", data: entry.captures.documentImage },
    { label: "IMAGEN 1", data: entry.captures.image1 },
    { label: "IMAGEN 2", data: entry.captures.image2 },
    { label: "IMAGEN 3", data: entry.captures.image3 },
    { label: "IMAGEN 4", data: entry.captures.image4 },
  ];

  return captureOrder.filter((item) => item.data);
}

function drawCaptureBlock(doc, block, position) {
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(position.x, position.y, position.width, position.height, 6, 6, "F");
  doc.setDrawColor(215, 225, 220);
  doc.roundedRect(position.x, position.y, position.width, position.height, 6, 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(24, 33, 29);
  doc.text(block.label, position.x + 4, position.y + 8);

  addImageSafe(doc, block.data, position.x + 4, position.y + 12, position.width - 8, position.height - 16);
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
    doc.text("No se pudo cargar", x + 4, y + 8);
  }
}

function buildFileName(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `CADETERIA_LOS_PALMA_${year}${month}${day}_${hours}${minutes}.pdf`;
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
