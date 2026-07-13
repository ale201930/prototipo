# INVECEM - Sistema de Gestión de Asistencia y Personal de Planta

Este proyecto es una plataforma web moderna e integrada para la administración de personal, control de asistencia, gestión de contratistas y programación de días no laborables para las plantas de **INVECEM**. Desarrollada con **Next.js** y conectada en tiempo real con **Firebase (Firestore, Authentication y Storage)**.

---

## 🚀 Características Principales

### 1. 🕒 Control de Asistencia en Tiempo Real (Módulo Inspector)
* **Lector y Escáner Integrado**: Permite registrar las entradas, salidas y descansos (almuerzo) de los trabajadores mediante la lectura de fichas técnicas o números de cédula.
* **Validación de Identificador**: Restringe el input a valores numéricos de entre 4 y 5 dígitos, alertando en caso de datos incompletos.
* **Monitoreo de Almuerzos**: Trazabilidad en vivo de los trabajadores fuera de planta con conteo regresivo y alarmas por demoras.

### 2. 👥 Gestión de Personal (Módulo Recursos Humanos)
* **Expedientes Digitales**: Registro completo de trabajadores (INVECEM, Pasantes y estudiantes INCES).
* **Control de Ausencias**: Administración del estatus nominal (`Vacaciones`, `Reposo Médico`, `Activo`).
* **Calendario de Feriados**: Programación de asuetos globales o parciales con exención automática de inasistencias.
* **Carga de Amonestaciones**: Registro e historial de incidencias digitales adjuntando archivos en formato PDF.

### 3. 🛡️ Enrolamiento de Contratistas (Módulo Protección Física)
* **Registro de Acceso Externo**: Control de personal perteneciente a cooperativas y empresas contratistas.
* **Validación de Seguridad**: Bloqueo automático del acceso a planta para contratistas inactivos o suspendidos.

### 4. ⚙️ Administración de Usuarios (Panel de Control)
* **Roles de Sistema**: Gestión jerárquica de accesos (`Administrador`, `Inspector`, `Recursos Humanos`, `Protección Física`).
* **Auditoría Interna**: Registro detallado de acciones y telemetría de auditoría para garantizar la seguridad de la información.

---

## 🛠️ Tecnologías Utilizadas

* **Framework**: [Next.js](https://nextjs.org/) (App Router)
* **Base de Datos y Seguridad**: [Firebase](https://firebase.google.com/) (Firestore, Auth, Storage)
* **Diseño e Interfaz**: CSS Moderno con gradientes dinámicos, microanimaciones y soporte responsivo.
* **Generación de Reportes**: Exportación de reportes limpios a PDF mediante `jsPDF` y `jsPDF-AutoTable`.

---

## 🏁 Inicio Rápido

### Prerrequisitos
Asegúrate de contar con Node.js instalado (versión 18 o superior recomendada).

### 1. Instalación de dependencias:
```bash
npm install
```

### 2. Configurar Variables de Entorno:
Crea un archivo `.env.local` en la raíz del proyecto basándote en `.env.example` y añade tus credenciales de Firebase:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id
```

### 3. Ejecutar el servidor de desarrollo:
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación en ejecución.

---

## 🛡️ Reglas de Validación de Datos Incorporadas

* **Cédulas de Identidad**: Limitadas estrictamente a un máximo de 8 dígitos numéricos.
* **Números de Teléfono**: Limitados estrictamente a un máximo de 11 dígitos numéricos.
* **Número de Ficha**: Entre 4 y 5 dígitos numéricos obligatorios.
* **Cálculo de Inasistencias**: El sistema analiza el estatus nominal. Si el trabajador está de vacaciones, reposo médico o el día es feriado (global o parcial asignado), queda exento de registrar falta automática.
