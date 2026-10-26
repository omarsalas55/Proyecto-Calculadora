// Servidor sencillo para BuildCalc.
// Usa módulos que ya vienen con Node.js. No usa Express ni CORS.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PUERTO = Number(process.env.PORT) || 3000;
const CARPETA = __dirname;
const ARCHIVO_DATOS = path.join(CARPETA, "data", "datos.json");

// Si todavía no existe el archivo de datos, lo crea vacío.
function leerDatos() {
    if (!fs.existsSync(ARCHIVO_DATOS)) {
        fs.mkdirSync(path.dirname(ARCHIVO_DATOS), { recursive: true });
        fs.writeFileSync(ARCHIVO_DATOS, JSON.stringify({ usuarios: [], calculos: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(ARCHIVO_DATOS, "utf8"));
}

// Guarda usuarios y cálculos en un archivo JSON.
function guardarDatos(datos) {
    fs.writeFileSync(ARCHIVO_DATOS, JSON.stringify(datos, null, 2));
}

// Envía una respuesta JSON al navegador.
function responder(respuesta, codigo, contenido) {
    respuesta.writeHead(codigo, { "Content-Type": "application/json; charset=utf-8" });
    respuesta.end(JSON.stringify(contenido));
}

// Lee el JSON que llega desde un formulario del frontend.
function leerCuerpo(solicitud) {
    return new Promise(function (resolver, rechazar) {
        let texto = "";
        solicitud.on("data", function (parte) { texto += parte; });
        solicitud.on("end", function () {
            try {
                resolver(texto ? JSON.parse(texto) : {});
            } catch (error) {
                rechazar(error);
            }
        });
        solicitud.on("error", rechazar);
    });
}

// Convierte la contraseña en un resumen antes de guardarla.
function resumirContrasena(contrasena) {
    return crypto.createHash("sha256").update(contrasena).digest("hex");
}

// Busca el tipo de archivo para que el navegador lo pueda mostrar.
function tipoDeArchivo(archivo) {
    const extension = path.extname(archivo);
    const tipos = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".webp": "image/webp"
    };
    return tipos[extension] || "application/octet-stream";
}

// Atiende las rutas de la API.
async function atenderApi(solicitud, respuesta, url) {
    const datos = leerDatos();
    const ruta = url.pathname;
    const metodo = solicitud.method;

    if (ruta === "/api/estado" && metodo === "GET") {
        responder(respuesta, 200, { mensaje: "BuildCalc está funcionando" });
        return;
    }

    // REGISTRO: guarda una cuenta nueva.
    if (ruta === "/api/registro" && metodo === "POST") {
        const cuerpo = await leerCuerpo(solicitud);
        const usuario = String(cuerpo.usuario || "").trim();
        const contrasena = String(cuerpo.contrasena || "");

        if (usuario.length < 3 || contrasena.length < 4) {
            responder(respuesta, 400, { error: "El usuario debe tener 3 caracteres y la contraseña 4 como mínimo." });
            return;
        }
        const existe = datos.usuarios.some(function (item) {
            return item.usuario.toLowerCase() === usuario.toLowerCase();
        });
        if (existe) {
            responder(respuesta, 409, { error: "Ese usuario ya está registrado." });
            return;
        }

        datos.usuarios.push({ usuario: usuario, contrasena: resumirContrasena(contrasena) });
        guardarDatos(datos);
        responder(respuesta, 201, { mensaje: "Cuenta creada." });
        return;
    }

    // INICIO DE SESIÓN: compara usuario y contraseña.
    if (ruta === "/api/ingresar" && metodo === "POST") {
        const cuerpo = await leerCuerpo(solicitud);
        const usuario = String(cuerpo.usuario || "").trim();
        const contrasena = String(cuerpo.contrasena || "");
        const cuenta = datos.usuarios.find(function (item) {
            return item.usuario.toLowerCase() === usuario.toLowerCase();
        });

        if (!cuenta || cuenta.contrasena !== resumirContrasena(contrasena)) {
            responder(respuesta, 401, { error: "Usuario o contraseña incorrectos." });
            return;
        }
        responder(respuesta, 200, { mensaje: "Bienvenido.", usuario: cuenta.usuario });
        return;
    }

    // Las demás rutas de la API solo permiten trabajar con el usuario que inició sesión.
    const usuarioActivo = solicitud.headers["x-usuario"];
    if (!usuarioActivo) {
        responder(respuesta, 401, { error: "Inicia sesión para continuar." });
        return;
    }

    // READ: devuelve los cálculos de esa cuenta.
    if (ruta === "/api/calculos" && metodo === "GET") {
        const lista = datos.calculos.filter(function (item) { return item.usuario === usuarioActivo; });
        responder(respuesta, 200, { calculos: lista });
        return;
    }

    // CREATE: guarda un cálculo nuevo.
    if (ruta === "/api/calculos" && metodo === "POST") {
        const cuerpo = await leerCuerpo(solicitud);
        if (!cuerpo.tipo || !cuerpo.resultado) {
            responder(respuesta, 400, { error: "Faltan los datos del cálculo." });
            return;
        }
        const calculo = {
            id: Date.now().toString(),
            usuario: usuarioActivo,
            tipo: String(cuerpo.tipo),
            nombre: String(cuerpo.nombre || cuerpo.tipo),
            fecha: new Date().toLocaleString("es-CO"),
            resultado: cuerpo.resultado
        };
        datos.calculos.push(calculo);
        guardarDatos(datos);
        responder(respuesta, 201, { mensaje: "Cálculo guardado.", calculo: calculo });
        return;
    }

    // Encontramos un cálculo por su número de identificación.
    const partes = ruta.match(/^\/api\/calculos\/(\d+)$/);
    if (partes) {
        const id = partes[1];
        const indice = datos.calculos.findIndex(function (item) {
            return item.id === id && item.usuario === usuarioActivo;
        });
        if (indice === -1) {
            responder(respuesta, 404, { error: "No encontramos ese cálculo." });
            return;
        }

        // UPDATE: cambia el nombre que aparece en el historial.
        if (metodo === "PUT") {
            const cuerpo = await leerCuerpo(solicitud);
            datos.calculos[indice].nombre = String(cuerpo.nombre || datos.calculos[indice].nombre);
            guardarDatos(datos);
            responder(respuesta, 200, { mensaje: "Cálculo actualizado." });
            return;
        }

        // DELETE: elimina el cálculo de la lista.
        if (metodo === "DELETE") {
            datos.calculos.splice(indice, 1);
            guardarDatos(datos);
            responder(respuesta, 200, { mensaje: "Cálculo eliminado." });
            return;
        }
    }

    responder(respuesta, 404, { error: "Ruta no encontrada." });
}

// Sirve el HTML, el CSS, el JavaScript y la imagen desde el mismo servidor.
function servirPagina(respuesta, url) {
    let ruta = decodeURIComponent(url.pathname);
    if (ruta === "/" || ruta === "/index.html") ruta = "/calculadora.html";
    const archivo = path.resolve(CARPETA, "." + ruta);

    if (!archivo.startsWith(CARPETA + path.sep) || archivo.endsWith("datos.json")) {
        respuesta.writeHead(404);
        respuesta.end("No encontrado");
        return;
    }

    fs.readFile(archivo, function (error, contenido) {
        if (error) {
            respuesta.writeHead(404);
            respuesta.end("No encontramos ese archivo.");
            return;
        }
        respuesta.writeHead(200, { "Content-Type": tipoDeArchivo(archivo) });
        respuesta.end(contenido);
    });
}

// Cada solicitud entra por aquí.
const servidor = http.createServer(function (solicitud, respuesta) {
    const url = new URL(solicitud.url, "http://localhost");

    if (url.pathname.startsWith("/api/")) {
        atenderApi(solicitud, respuesta, url).catch(function () {
            responder(respuesta, 400, { error: "No pudimos leer la solicitud." });
        });
    } else {
        servirPagina(respuesta, url);
    }
});

servidor.listen(PUERTO, function () {
    leerDatos();
    console.log("BuildCalc está listo en http://localhost:" + PUERTO);
});
