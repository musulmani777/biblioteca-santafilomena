(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const CONFIG = window.BIBLIOTECA_CONFIG || {};
  const DOMAIN = "escuelasantafilomena.cl";
  const PROFILE = "BIBLIOTECA";
  const BLOCKS = [
    ["08:00", "08:45"], ["08:45", "09:30"],
    ["09:45", "10:30"], ["10:30", "11:15"],
    ["11:30", "12:15"], ["12:15", "13:00"],
    ["14:00", "14:45"], ["14:45", "15:30"]
  ];
  const gate = $("#gate");
  const appShell = $("#app-shell");
  const startSelect = $("#start");
  const state = {
    idToken: "",
    email: "",
    name: "",
    selectedDate: "",
    selectedBlock: 1,
    calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    occupied: [],
    reservations: [],
    holidays: [],
    selectedRoom: false,
    refreshId: 0,
    availabilityId: 0
  };
  let refreshTimer = null;
  const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  function localDateString(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function localTimeString(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.hour}:${values.minute}`;
  }

  function formatDate(dateString) {
    return new Intl.DateTimeFormat("es-CL", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    }).format(new Date(`${dateString}T12:00:00`));
  }

  function setMessage(element, text, kind = "") {
    element.textContent = text;
    element.className = `message ${kind}`;
  }

  function setLoginError(text) {
    $("#login-error").textContent = text;
  }

  function errorMessage(code) {
    const messages = {
      autenticacion_requerida: "Vuelve a iniciar sesión con Google.",
      dominio_no_permitido: `Usa una cuenta @${DOMAIN}.`,
      token_invalido: "La sesión de Google expiró. Inicia sesión nuevamente.",
      bloque_ocupado: "Ese bloque ya fue solicitado. Elige otro.",
      datos_invalidos: "Revisa la fecha, el curso y la cantidad de alumnos.",
      plazo_5_dias: "Las solicitudes deben hacerse con al menos 5 días hábiles.",
      id_no_encontrado: "No se encontró esa reserva.",
      no_permitido: "No puedes modificar esta reserva.",
      estado_no_permitido: "Esta reserva ya no se puede cancelar.",
      base_datos_no_preparada: "La base de solicitudes aún no está preparada.",
      perfil_invalido: "La configuración de la sala no es válida."
    };
    return messages[code] || code || "No se pudo completar la solicitud.";
  }

  async function api(payload) {
    if (!CONFIG.appsScriptUrl) throw new Error("Falta configurar la URL del Apps Script.");
    let response;
    try {
      response = await fetch(CONFIG.appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payload),
        cache: "no-store"
      });
    } catch (error) {
      throw new Error("No se pudo conectar con la API. Revisa tu conexión a Internet.");
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error("El Apps Script respondió con un formato no válido.");
    }
    if (!response.ok || !data || data.ok !== true) {
      const code = data && data.error;
      if (["sin_token", "token_invalido", "autenticacion_requerida"].includes(code)) {
        expireSession(errorMessage(code));
      }
      throw new Error(errorMessage(code));
    }
    return data;
  }

  function expireSession(message) {
    if (refreshTimer) window.clearInterval(refreshTimer);
    state.idToken = "";
    state.email = "";
    state.name = "";
    appShell.hidden = true;
    gate.hidden = false;
    setLoginError(message);
  }

  function decodeJwtPayload(token) {
    const encoded = token.split(".")[1];
    if (!encoded) throw new Error("Respuesta de Google no válida.");
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function showApp(user) {
    state.idToken = user.credential;
    state.email = user.email;
    state.name = user.name;
    gate.hidden = true;
    appShell.hidden = false;
    $("#signed-email").textContent = state.email;
    $("#teacher-email").value = state.email;
    $("#teacher-name").value = state.name;
    initializeApp();
  }

  function handleGoogleCredential(response) {
    try {
      const claims = decodeJwtPayload(response.credential);
      const email = String(claims.email || "").toLowerCase();
      if (claims.email_verified !== true || String(claims.hd || "").toLowerCase() !== DOMAIN
          || !email.endsWith(`@${DOMAIN}`)) {
        setLoginError(`Usa una cuenta verificada @${DOMAIN}.`);
        return;
      }
      setLoginError("");
      showApp({
        credential: response.credential,
        email,
        name: String(claims.name || email)
      });
    } catch (error) {
      setLoginError(error.message || "No se pudo verificar la cuenta de Google.");
    }
  }

  function initializeGoogleSignIn(attempt = 0) {
    if (!CONFIG.googleClientId || !CONFIG.googleClientId.endsWith(".apps.googleusercontent.com")) {
      setLoginError("El administrador debe configurar el Google OAuth Client ID para habilitar el acceso.");
      return;
    }
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      if (attempt < 20) {
        window.setTimeout(() => initializeGoogleSignIn(attempt + 1), 250);
      } else {
        setLoginError("No se pudo cargar el inicio de sesión de Google.");
      }
      return;
    }

    window.google.accounts.id.initialize({
      client_id: CONFIG.googleClientId,
      callback: handleGoogleCredential,
      auto_select: false
    });
    window.google.accounts.id.renderButton($("#google-login-button"), {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "signin_with",
      locale: "es"
    });
  }

  function canonicalStatus(value) {
    const status = String(value || "").toUpperCase();
    if (status === "PENDIENTE") return "Pendiente";
    if (status === "APROBADA" || status === "ACEPTADA") return "Aprobada";
    if (status === "RECHAZADA") return "Rechazada";
    if (status === "CANCELADA") return "Cancelada";
    return status || "Ocupada";
  }

  function applyList(data) {
    state.occupied = Array.isArray(data.ocupados) ? data.ocupados : [];
    state.reservations = Array.isArray(data.reservas)
      ? data.reservas.filter((reservation) =>
        String(reservation.perfil || "").toUpperCase() === PROFILE)
      : [];
    state.holidays = Array.isArray(data.feriados) ? data.feriados : [];
  }

  async function loadTeacherData(fromDate) {
    return api({
      action: "listar",
      idToken: state.idToken,
      perfil: PROFILE,
      desde: fromDate
    });
  }

  function minimumBookingDate() {
    const date = new Date(`${localDateString()}T12:00:00`);
    let businessDays = 0;
    while (businessDays < 5) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay();
      const dateString = localDateString(date);
      if (day !== 0 && day !== 6 && !state.holidays.includes(dateString)) businessDays += 1;
    }
    return localDateString(date);
  }

  function dayStatuses(dateString) {
    return [...new Set(state.occupied
      .filter((item) => item.f === dateString)
      .map((item) => canonicalStatus(item.est))
      .filter((status) => status === "Pendiente" || status === "Aprobada"))];
  }

  function renderCalendar() {
    const grid = $("#calendar-grid");
    grid.replaceChildren();
    const title = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" })
      .format(state.calendarMonth);
    $("#calendar-heading").textContent = `Calendario · ${title}`;
    weekdays.forEach((day) => {
      const label = document.createElement("div");
      label.className = "weekday";
      label.setAttribute("role", "columnheader");
      label.textContent = day;
      grid.append(label);
    });

    const year = state.calendarMonth.getFullYear();
    const month = state.calendarMonth.getMonth();
    const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    for (let index = 0; index < firstOffset; index += 1) {
      const empty = document.createElement("div");
      empty.className = "day empty";
      empty.setAttribute("role", "gridcell");
      grid.append(empty);
    }

    const earliest = minimumBookingDate();
    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      const dateString = `${monthKey}-${String(dayNumber).padStart(2, "0")}`;
      const date = new Date(`${dateString}T12:00:00`);
      const statuses = dayStatuses(dateString);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "day";
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", formatDate(dateString));
      button.textContent = String(dayNumber);
      button.disabled = dateString < earliest || date.getDay() === 0 || date.getDay() === 6
        || state.holidays.includes(dateString);
      if (dateString === state.selectedDate) {
        button.classList.add("selected");
        button.setAttribute("aria-selected", "true");
      }
      if (dateString === localDateString()) button.classList.add("today");
      if (statuses.length) {
        const descriptions = [];
        if (statuses.includes("Aprobada")) descriptions.push("reserva aceptada");
        if (statuses.includes("Pendiente")) descriptions.push("solicitud pendiente");
        button.setAttribute("aria-label", `${formatDate(dateString)}: ${descriptions.join(", ")}`);
      }
      statuses.forEach((status) => {
        const dot = document.createElement("span");
        dot.className = `day-dot ${status === "Aprobada" ? "approved" : "pending"}`;
        dot.setAttribute("aria-label", status === "Aprobada" ? "Reserva aceptada" : "Solicitud pendiente");
        button.append(dot);
      });
      button.addEventListener("click", () => selectDate(dateString));
      grid.append(button);
    }
  }

  function setDateSummary() {
    $("#date-summary").textContent = state.selectedDate
      ? `Fecha seleccionada: ${formatDate(state.selectedDate)}`
      : "Selecciona un día disponible.";
  }

  function selectDate(dateString) {
    state.selectedDate = dateString;
    state.calendarMonth = new Date(`${dateString}T12:00:00`);
    state.calendarMonth.setDate(1);
    setDateSummary();
    refreshApp();
  }

  function changeMonth(offset) {
    state.calendarMonth.setMonth(state.calendarMonth.getMonth() + offset);
    if (state.selectedDate
        && (state.calendarMonth.getFullYear() !== Number(state.selectedDate.slice(0, 4))
          || state.calendarMonth.getMonth() !== Number(state.selectedDate.slice(5, 7)) - 1)) {
      state.selectedDate = "";
      setDateSummary();
    }
    refreshApp();
  }

  function showNoDateSelected() {
    state.selectedRoom = false;
    $("#submit-button").disabled = true;
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = "Selecciona una fecha disponible para consultar el bloque.";
    $("#availability-card").replaceChildren(message);
    setMessage($("#availability-message"), "");
  }

  function blockDetails(blockNumber) {
    return BLOCKS[Number(blockNumber) - 1] || null;
  }

  function renderAvailability(status) {
    const container = $("#availability-card");
    container.replaceChildren();
    const card = document.createElement("div");
    card.className = "availability-card";
    const name = document.createElement("span");
    name.className = "room-name";
    name.textContent = "Sala de Biblioteca";
    const badge = document.createElement("span");
    badge.className = `badge ${status === "Disponible" ? "available"
      : status === "Pendiente" ? "pending"
        : status === "Aprobada" ? "approved" : "cancelled"}`;
    badge.textContent = status === "Pendiente" ? "En revisión"
      : status === "Aprobada" ? "Ocupada · aceptada" : status;
    card.append(name, badge);
    container.append(card);
    state.selectedRoom = status === "Disponible";
    $("#submit-button").disabled = !state.selectedRoom;
    const block = blockDetails(startSelect.value);
    if (block) {
      setMessage($("#availability-message"), `Bloque consultado: ${block[0]}–${block[1]} · 45 minutos`);
    }
  }

  async function loadAvailability() {
    const requestId = ++state.availabilityId;
    state.selectedRoom = false;
    $("#submit-button").disabled = true;
    if (!state.selectedDate || !startSelect.value || !state.idToken) return;
    try {
      const result = await api({
        action: "disponibilidad",
        perfil: PROFILE,
        desde: state.selectedDate,
        dias: 1
      });
      if (requestId !== state.availabilityId) return;
      const occupied = result.ocupados.some((item) =>
        item.f === state.selectedDate && Number(item.b) === Number(startSelect.value));
      if (!occupied) {
        renderAvailability("Disponible");
        return;
      }
      const entry = state.occupied.find((item) =>
        item.f === state.selectedDate && Number(item.b) === Number(startSelect.value));
      renderAvailability(entry ? canonicalStatus(entry.est) : "Ocupada");
    } catch (error) {
      if (requestId !== state.availabilityId) return;
      $("#availability-card").textContent = error.message;
      setMessage($("#availability-message"), error.message, "error");
    }
  }

  function renderHistory() {
    const container = $("#history-list");
    container.replaceChildren();
    const reservations = [...state.reservations].sort((a, b) =>
      `${b.f}-${String(b.b).padStart(2, "0")}`.localeCompare(`${a.f}-${String(a.b).padStart(2, "0")}`));
    if (!reservations.length) {
      container.innerHTML = '<p class="empty-state">Aún no tienes solicitudes con esta cuenta.</p>';
      return;
    }

    reservations.forEach((reservation) => {
      const block = blockDetails(reservation.b);
      const status = canonicalStatus(reservation.est);
      const card = document.createElement("article");
      card.className = "reservation";
      const top = document.createElement("div");
      top.className = "reservation-top";
      const title = document.createElement("h4");
      title.textContent = "Sala de Biblioteca";
      const badge = document.createElement("span");
      badge.className = `badge ${status === "Pendiente" ? "pending"
        : status === "Aprobada" ? "approved"
          : status === "Rechazada" ? "rejected" : "cancelled"}`;
      badge.textContent = status === "Aprobada" ? "Aceptada" : status;
      top.append(title, badge);
      const details = document.createElement("p");
      details.textContent = `${formatDate(reservation.f)} · ${block ? `${block[0]}–${block[1]}` : `Bloque ${reservation.b}`} · ${reservation.curso} · ${reservation.pcs} alumnos`;
      card.append(top, details);
      if (reservation.respuesta) {
        const note = document.createElement("p");
        note.className = status === "Rechazada" ? "admin-note" : "";
        note.textContent = `${status === "Rechazada" ? "Motivo del rechazo: " : "Observación: "}${reservation.respuesta}`;
        card.append(note);
      }
      if (["Pendiente", "Aprobada"].includes(status) && canCancel(reservation, block)) {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "cancel";
        cancel.textContent = "Cancelar reserva";
        cancel.addEventListener("click", () => cancelReservation(reservation.id, cancel));
        const actions = document.createElement("p");
        actions.append(cancel);
        card.append(actions);
      }
      container.append(card);
    });
  }

  function canCancel(reservation, block) {
    const today = localDateString();
    if (reservation.f > today) return true;
    if (reservation.f < today || !block) return false;
    const now = localTimeString();
    return now < block[0];
  }

  async function refreshApp() {
    if (!state.idToken) return;
    const requestId = ++state.refreshId;
    const monthStart = `${state.calendarMonth.getFullYear()}-${String(state.calendarMonth.getMonth() + 1).padStart(2, "0")}-01`;
    try {
      const data = await loadTeacherData(monthStart);
      if (requestId !== state.refreshId) return;
      applyList(data);
      renderCalendar();
      renderHistory();
      if (state.selectedDate) await loadAvailability();
      else showNoDateSelected();
      setMessage($("#history-message"), "");
    } catch (error) {
      if (requestId !== state.refreshId) return;
      setMessage($("#availability-message"), error.message, "error");
      setMessage($("#history-message"), error.message, "error");
    }
  }

  function reservationKey() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async function cancelReservation(id, button) {
    if (!window.confirm("¿Quieres cancelar esta reserva?")) return;
    button.disabled = true;
    try {
      await api({
        action: "cancelar",
        idToken: state.idToken,
        perfil: PROFILE,
        id
      });
      await refreshApp();
      setMessage($("#history-message"), "Reserva cancelada.", "success");
    } catch (error) {
      button.disabled = false;
      setMessage($("#history-message"), error.message, "error");
    }
  }

  async function initializeApp() {
    if (refreshTimer) window.clearInterval(refreshTimer);
    try {
      const initial = await loadTeacherData(localDateString());
      applyList(initial);
      state.selectedDate = minimumBookingDate();
      state.calendarMonth = new Date(`${state.selectedDate}T12:00:00`);
      state.calendarMonth.setDate(1);
      startSelect.value = "1";
      setDateSummary();
      $("#hours-help").textContent = "Lunes a viernes · bloques de 45 minutos · al menos 5 días hábiles de anticipación";
      renderCalendar();
      renderHistory();
      await loadAvailability();
      setMessage($("#history-message"), "");
      refreshTimer = window.setInterval(() => {
        if (!appShell.hidden && document.visibilityState === "visible") refreshApp();
      }, 30000);
    } catch (error) {
      setMessage($("#availability-message"), error.message, "error");
      setMessage($("#history-message"), error.message, "error");
    }
  }

  BLOCKS.forEach((block, index) => {
    const option = document.createElement("option");
    option.value = String(index + 1);
    option.textContent = `Bloque ${index + 1} · ${block[0]}–${block[1]}`;
    startSelect.append(option);
  });

  $("#previous-month").addEventListener("click", () => changeMonth(-1));
  $("#next-month").addEventListener("click", () => changeMonth(1));
  startSelect.addEventListener("change", loadAvailability);
  $("#refresh-history").addEventListener("click", refreshApp);

  $("#request-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    if (!state.selectedRoom) {
      setMessage($("#form-message"), "Ese bloque no está disponible. Elige otro.", "error");
      return;
    }
    const button = $("#submit-button");
    button.disabled = true;
    const motivo = $("#reason").value.trim();
    const requerimientos = $("#requirements").value.trim();
    const observacion = [
      `Motivo: ${motivo}`,
      requerimientos ? `Requerimientos: ${requerimientos}` : ""
    ].filter(Boolean).join("\n").slice(0, 500);
    try {
      const result = await api({
        action: "crear",
        idToken: state.idToken,
        clave: reservationKey(),
        tipo: "RESERVA",
        perfil: PROFILE,
        fecha: state.selectedDate,
        bloque: Number(startSelect.value),
        curso: $("#course").value.trim(),
        asignatura: $("#department").value.trim(),
        pcs: Number($("#students").value),
        observacion,
        incidencias: []
      });
      $("#request-form").reset();
      setMessage($("#form-message"), `Solicitud ${result.id} enviada. Estado: Pendiente.`, "success");
      await refreshApp();
    } catch (error) {
      setMessage($("#form-message"), error.message, "error");
      await loadAvailability();
    }
  });

  $("#logout-button").addEventListener("click", () => {
    expireSession("");
    state.occupied = [];
    state.reservations = [];
    $("#teacher-name").value = "";
    $("#teacher-email").value = "";
    $("#request-form").reset();
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  });

  window.addEventListener("focus", () => {
    if (!appShell.hidden && state.idToken) refreshApp();
  });
  window.addEventListener("load", () => initializeGoogleSignIn());
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js")
        .catch((error) => console.error("No se pudo registrar la aplicación instalable:", error));
    });
  }
})();
