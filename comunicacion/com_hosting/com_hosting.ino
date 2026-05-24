#include <WiFi.h>
#include <HTTPClient.h>
#include <TinyGPSPlus.h>

/* ================= CONFIGURACIÓN ================= */
const char* ssid     = "erick_2.4G";
const char* password = "secom100";
const char* server   = "http://192.168.0.102:5000/datos";


/* ================= UART FPGA ================= */
HardwareSerial SerialFPGA(2);
HardwareSerial SerialGPS(1);
TinyGPSPlus gps;

/* ================= PINES ================= */
const int PIN_PANICO = 13;
const int PIN_MANUAL = 14;
const int LED_PANICO = 12;   
const int LED_MANUAL = 27;

/* ================= VARIABLES FPGA ================= */
String vehiculo  = "camion_1";
String estado    = "activo";
String puerta    = "cerrada";
int    alerta    = 0;
int    vibracion = 0;

/* ================= VARIABLES BOTONES ================= */
bool modoManual             = false;
bool modoPanico             = false;

/* ================= GPS ================= */
float lat       = 0.0;
float lng       = 0.0;
bool  gpsValido = false;
const float DISTANCIA_MINIMA_METROS = 30.0;
float latAnterior = 0.0;
float lngAnterior = 0.0;

/* ================= CONTROL CAMBIOS ================= */
String estadoAnterior    = "";
String puertaAnterior    = "";
int    alertaAnterior    = -1;
int    vibracionAnterior = -1;
unsigned long ultimoEnvio = 0;
const unsigned long INTERVALO_MAXIMO = 1500;

/* ================= WIFI ================= */
unsigned long ultimoIntentoWiFi = 0;
bool botonPanicoPresionado  = false;
/* ================= LOG LIMPIO ================= */
// Solo imprime si el mensaje cambió — evita spam repetido
String _ultimoLog = "";
void log(String msg) {
    if (msg != _ultimoLog) {
        Serial.println(msg);
        _ultimoLog = msg;
    }
}

// Siempre imprime sin importar si se repite
void logSiempre(String msg) {
    Serial.println(msg);
}

/* ================= HAVERSINE ================= */
float calcularDistancia(float lat1, float lon1, float lat2, float lon2) {
    const float R = 6371000.0;
    float dLat = (lat2 - lat1) * DEG_TO_RAD;
    float dLon = (lon2 - lon1) * DEG_TO_RAD;
    float a = sin(dLat/2)*sin(dLat/2) +
              cos(lat1*DEG_TO_RAD)*cos(lat2*DEG_TO_RAD)*
              sin(dLon/2)*sin(dLon/2);
    return R * 2.0 * atan2(sqrt(a), sqrt(1.0-a));
}

/* ================= SETUP ================= */
void setup() {
    Serial.begin(115200);
    SerialFPGA.begin(115200, SERIAL_8N1, 16, 17);
    SerialGPS.begin(9600, SERIAL_8N1, 4, 5);

    pinMode(PIN_PANICO, INPUT_PULLUP);
    pinMode(PIN_MANUAL, INPUT_PULLUP);
    pinMode(LED_PANICO, OUTPUT);    // ← agregar
    pinMode(LED_MANUAL, OUTPUT);    // ← agregar
    digitalWrite(LED_PANICO, LOW);  // ← apagado al inicio
    digitalWrite(LED_MANUAL, LOW);  // ← apagado al inicio

    Serial.println("\n=== TrackSecurity ESP32 ===");
    Serial.print("Conectando WiFi");
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi OK → " + WiFi.localIP().toString());
    Serial.println("GPS buscando señal...");
    Serial.println("===========================\n");
}

/* ================= LOOP ================= */
void loop() {

    /* ── WIFI ── */
    if (WiFi.status() != WL_CONNECTED) {
        unsigned long ahora = millis();
        if (ahora - ultimoIntentoWiFi > 5000) {
            logSiempre("⚠ WiFi caído — reconectando...");
            WiFi.disconnect();
            WiFi.begin(ssid, password);
            ultimoIntentoWiFi = ahora;
        }
        return;
    }

    leerBotones();
    leerGPS();
    leerUART_FPGA();

    /* ── APLICAR MODOS ── */
    if (modoPanico) {
        estado = "panico";
        alerta = 1;
    } else if (modoManual) {
        estado = "manual";
        alerta = 0;
    }

    /* ── ENVÍO ── */
    bool cambioReal = (estado    != estadoAnterior)
                   || (puerta    != puertaAnterior)
                   || (alerta    != alertaAnterior)
                   || (vibracion != vibracionAnterior);

    unsigned long ahora = millis();
    bool tiempoExcedido = (ahora - ultimoEnvio) >= INTERVALO_MAXIMO;

    if (cambioReal || tiempoExcedido) {
        enviarDatos();
        ultimoEnvio       = ahora;
        estadoAnterior    = estado;
        puertaAnterior    = puerta;
        alertaAnterior    = alerta;
        vibracionAnterior = vibracion;
    }

    delay(10);
}

/* ================= BOTONES ================= */
void leerBotones() {

    /* Interruptor manual */
    bool switchActivo = (digitalRead(PIN_MANUAL) == LOW);
    if (switchActivo != modoManual) {
        modoManual = switchActivo;
        logSiempre(modoManual
            ? "🔧 MODO MANUAL activado"
            : "✅ MODO MANUAL desactivado");
        if (!modoManual) estado = "activo";
        digitalWrite(LED_MANUAL, modoManual ? HIGH : LOW);  // ← agregar
    }

    /* Botón pánico — lectura directa (botón de enclave) */
    bool panicoActivo = (digitalRead(PIN_PANICO) == LOW);

    if (panicoActivo != modoPanico) {
        modoPanico = panicoActivo;
        logSiempre(modoPanico
            ? "🚨 PÁNICO ACTIVADO"
            : "✅ PÁNICO desactivado");
        if (!modoPanico) {
            estado = "activo";
            alerta = 0;
        }
        digitalWrite(LED_PANICO, modoPanico ? HIGH : LOW);
    }
}

/* ================= GPS ================= */
void leerGPS() {
    while (SerialGPS.available() > 0) {
        gps.encode(SerialGPS.read());
    }

    /*
    if (!gps.location.isValid() || !gps.location.isUpdated()) {
        // Solo avisa una vez, no cada segundo
        if (millis() > 15000 && gps.charsProcessed() < 10) {
            log("⚠ GPS sin datos — verifica conexión");
        } else if (!gpsValido) {
            log("GPS buscando satélites...");
        }
        return;
    }
    */
    if (!gps.location.isValid() || !gps.location.isUpdated()) {

    // ================= GPS SIMULADO TEMPORAL =================
    lat = 16.756360;     // Tuxtla Gutiérrez ejemplo
    lng = -93.171529;
    gpsValido = true;

    return;
    }

    /* Filtro HDOP — calidad de señal */
    if (gps.hdop.isValid() && gps.hdop.hdop() > 3.0) {
        log("GPS señal débil (HDOP=" +
            String(gps.hdop.hdop(), 1) + ") — descartando");
        return;
    }

    /* Filtro satélites mínimos */
    if (gps.satellites.isValid() && gps.satellites.value() < 4) {
        log("GPS pocos satélites (" +
            String(gps.satellites.value()) + ") — descartando");
        return;
    }

    float nuevaLat = gps.location.lat();
    float nuevaLng = gps.location.lng();

    /* Primera lectura válida */
    if (!gpsValido) {
        lat = nuevaLat; lng = nuevaLng;
        latAnterior = nuevaLat; lngAnterior = nuevaLng;
        gpsValido = true;
        logSiempre("✅ GPS señal obtenida → " +
            String(lat,6) + ", " + String(lng,6) +
            " | Sats:" + String(gps.satellites.value()) +
            " HDOP:" + String(gps.hdop.hdop(),1));
        return;
    }

    float distancia = calcularDistancia(
        latAnterior, lngAnterior, nuevaLat, nuevaLng);

    if (distancia >= DISTANCIA_MINIMA_METROS) {
        lat = nuevaLat; lng = nuevaLng;
        latAnterior = nuevaLat; lngAnterior = nuevaLng;
        /* Solo imprime cuando hay movimiento real */
        logSiempre("📍 GPS +" + String(distancia,0) + "m → " +
            String(lat,6) + ", " + String(lng,6) +
            " | Sats:" + String(gps.satellites.value()));
    }
    /* Si está quieto → silencio total, no imprime nada */
}

/* ================= FPGA ================= */
bool leerUART_FPGA() {
    bool recibiAlgo = false;

    while (SerialFPGA.available()) {
        char dato = SerialFPGA.read();
        recibiAlgo = true;

        /* Solo imprime si cambia el estado */
        String estadoNuevo = estado;

        if (dato == 'A') {
            estadoNuevo = "alerta"; alerta = 1;
            vibracion = 1; puerta = "cerrada";
        }
        else if (dato == 'P') {
            estadoNuevo = "alerta"; alerta = 1;
            vibracion = 0; puerta = "abierta";
        }
        else if (dato == 'B') {
            estadoNuevo = "alerta"; alerta = 1;
            vibracion = 1; puerta = "abierta";
        }
        else if (dato == 'N') {
            estadoNuevo = "activo"; alerta = 0;
            vibracion = 0; puerta = "cerrada";
        }

        /* Solo loguea si el estado cambió */
        if (!modoPanico && !modoManual && estadoNuevo != estado) {
            if (dato == 'N') logSiempre("✅ FPGA → Normal");
            else if (dato == 'A') logSiempre("⚠ FPGA → Vibración detectada");
            else if (dato == 'P') logSiempre("⚠ FPGA → Puerta abierta");
            else if (dato == 'B') logSiempre("🚨 FPGA → Ambos sensores");
        }

        estado = estadoNuevo;
    }

    return recibiAlgo;
}

/* ================= ENVIAR ================= */
void enviarDatos() {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    http.begin(server);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(1500);

    String latStr = gpsValido ? String(lat, 6) : "null";
    String lngStr = gpsValido ? String(lng, 6) : "null";

    String json = "{";
    json += "\"vehiculo\":\""  + vehiculo          + "\",";
    json += "\"estado\":\""    + estado            + "\",";
    json += "\"alerta\":"      + String(alerta)    + ",";
    json += "\"puerta\":\""    + puerta            + "\",";
    json += "\"vibracion\":"   + String(vibracion) + ",";
    json += "\"lat\":"         + latStr            + ",";
    json += "\"lng\":"         + lngStr            + ",";
    json += "\"gps_valido\":"  + String(gpsValido ? 1 : 0);
    json += "}";

    int code = http.POST(json);

    /* Solo loguea si hay error HTTP */
    if (code <= 0) {
        logSiempre("✗ Error envío: " + http.errorToString(code));
    }

    http.end();
}