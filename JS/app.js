// JavaScript de la aplicación. Separamos el código del HTML para que sea más fácil encontrarlo.
let modoRegistro = false;

// Muestra una pantalla y oculta las demás.
function mostrarPantalla(id) {
    document.querySelectorAll(".panel").forEach(function (panel) {
        panel.classList.add("oculto");
    });
    document.getElementById(id).classList.remove("oculto");
}

function mostrarMensaje(texto, tipo) {
    const caja = document.getElementById("mensajeAuth");
    caja.textContent = texto;
    caja.className = "mensaje " + tipo;
}

function nombreUsuario() {
    return sessionStorage.getItem("buildcalc.usuario");
}

// Función común para enviar y recibir información JSON del servidor.
async function llamarApi(ruta, opciones) {
    const configuracion = opciones || {};
    configuracion.headers = configuracion.headers || {};
    configuracion.headers.Accept = "application/json";
    if (configuracion.body) configuracion.headers["Content-Type"] = "application/json";
    if (nombreUsuario()) configuracion.headers["X-Usuario"] = nombreUsuario();

    const respuesta = await fetch(ruta, configuracion);
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.error || "Ocurrió un error.");
    return datos;
}

// Cambia entre la pantalla de ingreso y la de registro.
document.getElementById("btnCambiarModo").addEventListener("click", function () {
    modoRegistro = !modoRegistro;
    document.getElementById("tituloAuth").textContent = modoRegistro ? "Crear cuenta" : "Iniciar sesión";
    document.getElementById("btnAccionAuth").textContent = modoRegistro ? "Registrarme" : "Ingresar";
    document.getElementById("btnCambiarModo").textContent = modoRegistro
        ? "¿Ya tienes cuenta? Inicia sesión"
        : "¿No tienes cuenta? Regístrate";
    document.getElementById("mensajeAuth").textContent = "";
    document.getElementById("mensajeAuth").className = "mensaje";
});

// Registra una cuenta o inicia sesión.
document.getElementById("btnAccionAuth").addEventListener("click", async function () {
    const usuario = document.getElementById("authUsuario").value.trim();
    const contrasena = document.getElementById("authPassword").value;

    try {
        const ruta = modoRegistro ? "/api/registro" : "/api/ingresar";
        const respuesta = await llamarApi(ruta, {
            method: "POST",
            body: JSON.stringify({ usuario: usuario, contrasena: contrasena })
        });

        if (modoRegistro) {
            document.getElementById("btnCambiarModo").click();
            document.getElementById("authPassword").value = "";
            mostrarMensaje("Cuenta creada. Ahora puedes ingresar.", "ok");
        } else {
            sessionStorage.setItem("buildcalc.usuario", respuesta.usuario);
            document.getElementById("nombreUsuarioActivo").textContent = respuesta.usuario;
            mostrarPantalla("pantallaMenu");
        }
    } catch (error) {
        mostrarMensaje(error.message, "error");
    }
});

// Abre la calculadora elegida desde el menú.
document.querySelectorAll(".lista-menu button[data-ir]").forEach(function (boton) {
    boton.addEventListener("click", function () {
        mostrarPantalla(boton.getAttribute("data-ir"));
        if (boton.getAttribute("data-ir") === "pantallaHistorial") cargarHistorial();
    });
});

// Cierra la sesión en este navegador.
document.getElementById("btnSalir").addEventListener("click", function () {
    sessionStorage.removeItem("buildcalc.usuario");
    document.getElementById("authUsuario").value = "";
    document.getElementById("authPassword").value = "";
    mostrarPantalla("pantallaAuth");
});

// Lee un campo numérico y avisa si está vacío o no es mayor que cero.
function leerNumero(id) {
    const campo = document.getElementById(id);
    const numero = Number(campo.value);
    if (!campo.value || !Number.isFinite(numero) || numero <= 0) {
        alert("Escribe un número mayor que cero.");
        campo.focus();
        return null;
    }
    return numero;
}

// Muestra las filas del resultado con una tabla.
function mostrarResultado(id, filas) {
    const caja = document.getElementById(id);
    caja.innerHTML = "";
    const tabla = document.createElement("table");

    filas.forEach(function (fila) {
        const tr = document.createElement("tr");
        const nombre = document.createElement("td");
        const valor = document.createElement("td");
        nombre.textContent = fila[0];
        valor.textContent = fila[1];
        tr.appendChild(nombre);
        tr.appendChild(valor);
        tabla.appendChild(tr);
    });

    caja.appendChild(tabla);
    caja.classList.remove("oculto");
}

// Guarda el resultado calculado en el archivo JSON a través del backend.
async function terminarCalculo(tipo, idResultado, filas) {
    mostrarResultado(idResultado, filas);
    const resultado = {};
    filas.forEach(function (fila) { resultado[fila[0]] = fila[1]; });

    try {
        await llamarApi("/api/calculos", {
            method: "POST",
            body: JSON.stringify({ tipo: tipo, resultado: resultado })
        });
    } catch (error) {
        alert("El resultado apareció, pero no se pudo guardar: " + error.message);
    }
}

function calcularMuro() {
    const largo = leerNumero("muroLargo");
    const alto = leerNumero("muroAlto");
    if (largo === null || alto === null) return;

    const espesor = document.getElementById("muroEspesor").value;
    const area = largo * alto;
    const cementoPorMetro = espesor === "20" ? 10.9 : 15.2;
    const arenaPorMetro = espesor === "20" ? 0.09 : 0.115;
    const ladrillosPorMetro = espesor === "20" ? 90 : 120;
    terminarCalculo("Muro", "resultadoMuro", [
        ["Superficie", area.toFixed(2) + " m²"],
        ["Cemento", (area * cementoPorMetro).toFixed(2) + " kg"],
        ["Arena", (area * arenaPorMetro).toFixed(3) + " m³"],
        ["Ladrillos", Math.ceil(area * ladrillosPorMetro) + " unidades"]
    ]);
}

function calcularViga() {
    const largo = leerNumero("vigaLargo");
    if (largo === null) return;
    terminarCalculo("Viga", "resultadoViga", [
        ["Cemento", (largo * 9).toFixed(2) + " kg"],
        ["Arena", (largo * 0.02).toFixed(3) + " m³"],
        ["Piedra", (largo * 0.02).toFixed(3) + " m³"],
        ["Hierro del 8", (largo * 4).toFixed(2) + " m"],
        ["Hierro del 4", (largo * 3).toFixed(2) + " m"]
    ]);
}

function calcularColumna() {
    const largo = leerNumero("columnaLargo");
    if (largo === null) return;
    terminarCalculo("Columna", "resultadoColumna", [
        ["Cemento", (largo * 7.5).toFixed(2) + " kg"],
        ["Arena", (largo * 0.016).toFixed(3) + " m³"],
        ["Piedra", (largo * 0.016).toFixed(3) + " m³"],
        ["Hierro del 10", (largo * 6).toFixed(2) + " m"],
        ["Hierro del 4", (largo * 3).toFixed(2) + " m"]
    ]);
}

function calcularContrapiso() {
    const espesor = leerNumero("contrapisoEspesor");
    const ancho = leerNumero("contrapisoAncho");
    const largo = leerNumero("contrapisoLargo");
    if (espesor === null || ancho === null || largo === null) return;

    const volumen = largo * ancho * espesor;
    terminarCalculo("Contrapiso", "resultadoContrapiso", [
        ["Volumen", volumen.toFixed(3) + " m³"],
        ["Cemento", (volumen * 105).toFixed(2) + " kg"],
        ["Arena", (volumen * 0.45).toFixed(3) + " m³"],
        ["Piedra", (volumen * 0.9).toFixed(3) + " m³"]
    ]);
}

function calcularTecho() {
    const espesor = leerNumero("techoEspesor");
    const ancho = leerNumero("techoAncho");
    const largo = leerNumero("techoLargo");
    if (espesor === null || ancho === null || largo === null) return;

    const area = largo * ancho;
    terminarCalculo("Techo", "resultadoTecho", [
        ["Superficie", area.toFixed(2) + " m²"],
        ["Cemento", (area * 33).toFixed(2) + " kg"],
        ["Arena", (area * 0.072).toFixed(3) + " m³"],
        ["Piedra", (area * 0.072).toFixed(3) + " m³"],
        ["Hierro del 8", (area * 7).toFixed(2) + " m"],
        ["Hierro del 6", (area * 4).toFixed(2) + " m"]
    ]);
}

function calcularPiso() {
    const ancho = leerNumero("pisoAncho");
    const largo = leerNumero("pisoLargo");
    if (ancho === null || largo === null) return;

    const area = largo * ancho;
    terminarCalculo("Piso", "resultadoPiso", [
        ["Superficie", area.toFixed(2) + " m²"],
        ["Total con 10% extra", (area * 1.1).toFixed(2) + " m²"]
    ]);
}

function calcularPintura() {
    const superficie = leerNumero("pinturaSuperficie");
    if (superficie === null) return;
    terminarCalculo("Pintura", "resultadoPintura", [
        ["Superficie", superficie.toFixed(2) + " m²"],
        ["Pintura necesaria", (superficie / 6).toFixed(2) + " L"]
    ]);
}

// Consulta y muestra el historial guardado para el usuario.
async function cargarHistorial() {
    const cuerpo = document.getElementById("filasHistorial");
    const mensaje = document.getElementById("mensajeHistorial");
    cuerpo.innerHTML = "";
    mensaje.textContent = "Cargando...";

    try {
        const respuesta = await llamarApi("/api/calculos");
        mensaje.textContent = respuesta.calculos.length
            ? "Cálculos guardados: " + respuesta.calculos.length
            : "Todavía no tienes cálculos guardados.";

        respuesta.calculos.forEach(function (calculo) {
            const fila = document.createElement("tr");
            const tipo = document.createElement("td");
            const fecha = document.createElement("td");
            const acciones = document.createElement("td");
            tipo.textContent = calculo.nombre;
            fecha.textContent = calculo.fecha;

            const ver = document.createElement("button");
            ver.textContent = "Ver";
            ver.addEventListener("click", function () {
                const lineas = Object.entries(calculo.resultado).map(function (item) {
                    return item[0] + ": " + item[1];
                });
                alert(lineas.join("\n"));
            });

            const editar = document.createElement("button");
            editar.textContent = "Editar";
            editar.addEventListener("click", async function () {
                const nuevoNombre = prompt("Escribe el nuevo nombre:", calculo.nombre);
                if (!nuevoNombre || !nuevoNombre.trim()) return;
                try {
                    await llamarApi("/api/calculos/" + calculo.id, {
                        method: "PUT",
                        body: JSON.stringify({ nombre: nuevoNombre.trim() })
                    });
                    cargarHistorial();
                } catch (error) {
                    alert(error.message);
                }
            });

            const eliminar = document.createElement("button");
            eliminar.textContent = "Eliminar";
            eliminar.addEventListener("click", async function () {
                if (!confirm("¿Eliminar este cálculo?")) return;
                try {
                    await llamarApi("/api/calculos/" + calculo.id, { method: "DELETE" });
                    cargarHistorial();
                } catch (error) {
                    alert(error.message);
                }
            });

            acciones.appendChild(ver);
            acciones.appendChild(editar);
            acciones.appendChild(eliminar);
            fila.appendChild(tipo);
            fila.appendChild(fecha);
            fila.appendChild(acciones);
            cuerpo.appendChild(fila);
        });
    } catch (error) {
        mensaje.textContent = error.message;
    }
}
