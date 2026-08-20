// ============================================================
// VIGILANTE GLOBAL DE ALERTAS Y SÍNTESIS DE VOZ (TEXT-TO-SPEECH)
// ============================================================

let globalAlertasTimer = null;
let idsAlertasConocidasGlobal = new Set();
let primeraCargaGlobal = true;

document.addEventListener("DOMContentLoaded", async () => {
    // Verificamos que el usuario esté logueado como dueño o supervisor
    const user = window.TrackAuth ? TrackAuth.getUser() : null;
    if (!user || (user.tipo !== "dueno" && user.tipo !== "supervisor")) {
        return;
    }

    // Iniciamos la primera consulta para llenar la memoria sin hacer ruido
    await consultarAlertasGlobal();

    // Consultar el servidor cada 5 segundos en segundo plano
    const intervaloMs = await TrackConfig.obtenerOperacionMs("alertas", 5);
    
    globalAlertasTimer = setInterval(async () => {
        await consultarAlertasGlobal();
    }, intervaloMs);
});

async function consultarAlertasGlobal() {
    try {
        const response = await TrackAPI.obtenerAlertas();
        const nuevasAlertas = response.alertas || [];

        if (primeraCargaGlobal) {
            // En la primera carga, solo memorizamos los IDs para no hablar de alertas pasadas
            nuevasAlertas.forEach(a => idsAlertasConocidasGlobal.add(a.id));
            primeraCargaGlobal = false;
        } else {
            nuevasAlertas.forEach(a => {
                // Si encontramos un ID que no estaba en nuestra lista
                if (!idsAlertasConocidasGlobal.has(a.id)) {
                    idsAlertasConocidasGlobal.add(a.id); // Lo memorizamos
                    
                    // Verificamos si es crítica o alta y no está atendida
                    const nivel = normalizarGlobal(a.nivel || "medio");
                    if (!a.atendida && (nivel === "critico" || nivel === "alto")) {
                        
                        // Armamos el texto inteligente
                        const tipoAlertaTexto = formatearTipoGlobal(normalizarGlobal(a.tipo));
                        const nombreVehiculo = a.vehiculo || "una unidad desconocida";
                        
                        const mensajeVoz = `Atención. ${tipoAlertaTexto}, en ${nombreVehiculo}, revise de inmediato la unidad.`;
                        
                        anunciarAlertaPorVoz(mensajeVoz);   
                    }
                }
            });
        }
    } catch (error) {
        console.error("Error en el vigilante global de alertas:", error);
    }
}

function anunciarAlertaPorVoz(texto) {
    if (!('speechSynthesis' in window)) {
        console.warn("El navegador no soporta síntesis de voz.");
        return;
    }

    window.speechSynthesis.cancel(); // Detiene audios previos

    // 🌟 AQUÍ ESTÁ EL TRUCO: Duplicamos el texto y le agregamos un "Repito."
    const mensajeDoble = `${texto} ... Repito ... ${texto}`;

    // Le pasamos el mensaje doble a la voz
    const utterance = new SpeechSynthesisUtterance(mensajeDoble);
    
    // Obtenemos todas las voces disponibles
    const voces = window.speechSynthesis.getVoices();
    const nombreVozDeseada = "Microsoft Dalia"; // Cambia esto por la voz que te haya gustado
    
    const vozElegida = voces.find(v => v.name.includes(nombreVozDeseada));

    if (vozElegida) {
        utterance.voice = vozElegida;
    } else {
        utterance.lang = 'es-MX';
    }

    utterance.rate = 1.0;  // Velocidad
    utterance.pitch = 1.3; // Tono

    window.speechSynthesis.speak(utterance);
}

// Funciones auxiliares para no depender del JS local
function normalizarGlobal(valor) {
    return String(valor || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatearTipoGlobal(tipo) {
    const mapa = {
        panico: "Botón de pánico activado",
        puerta_abierta: "Apertura de puerta no autorizada",
        vibracion: "Vibración fuerte detectada",
        alerta_general: "Alerta general"
    };
    return mapa[tipo] || tipo.replaceAll("_", " ");
}