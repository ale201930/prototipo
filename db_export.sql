-- Volcado de base de datos de INVECEM (Firebase a SQL para Laragon)
CREATE DATABASE IF NOT EXISTS invecem;
USE invecem;

-- Tabla: personal
DROP TABLE IF EXISTS `personal`;
CREATE TABLE `personal` (
  `id` TEXT,
  `horaEntrada` TEXT,
  `carreraPasante` TEXT,
  `regimenLaboral` TEXT,
  `fechaRegistro` TEXT,
  `fechaFin` TEXT,
  `fechaIngreso` TEXT,
  `fechaInicioCiclo` TEXT,
  `programaInces` TEXT,
  `correo` TEXT,
  `horaSalida` TEXT,
  `ficha` TEXT,
  `tipoPersonal` TEXT,
  `fechaSalida` TEXT,
  `universidadPasante` TEXT,
  `estatus` TEXT,
  `estado` TEXT,
  `cargo` TEXT,
  `area` TEXT,
  `historialIncidencias` TEXT,
  `nombres` TEXT,
  `cedula` TEXT,
  `apellidos` TEXT,
  `fechaRegreso` TEXT,
  `ultimaActualizacion` TEXT,
  `cohorteInces` TEXT,
  `esNocturno` TEXT,
  `telefono` TEXT,
  `fechaEgreso` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `personal` (`id`, `horaEntrada`, `carreraPasante`, `regimenLaboral`, `fechaRegistro`, `fechaFin`, `fechaIngreso`, `fechaInicioCiclo`, `programaInces`, `correo`, `horaSalida`, `ficha`, `tipoPersonal`, `fechaSalida`, `universidadPasante`, `estatus`, `estado`, `cargo`, `area`, `historialIncidencias`, `nombres`, `cedula`, `apellidos`, `fechaRegreso`, `ultimaActualizacion`, `cohorteInces`, `esNocturno`, `telefono`, `fechaEgreso`) VALUES ('9DxVIFobydzcgUQqt4UV', '19:00', '', 'TURNO_4X4', '2026-04-23T22:07:33.274Z', '2026-06-29', '2005-02-20', '2026-04-23', '', 'zoraidaorta1971@gmail.com', '07:00', '27853', 'INVECEM', '2026-05-29', '', 'Vacaciones', 'Vacaciones', 'mecanico', 'Mantenimiento', '[]', 'luis', '24475159', 'Almaguer', '2026-06-29', '2026-05-18T20:12:56.560Z', '', 'true', '04125063044', '');
INSERT INTO `personal` (`id`, `horaEntrada`, `carreraPasante`, `regimenLaboral`, `fechaRegistro`, `fechaFin`, `fechaIngreso`, `fechaInicioCiclo`, `programaInces`, `correo`, `horaSalida`, `ficha`, `tipoPersonal`, `fechaSalida`, `universidadPasante`, `estatus`, `estado`, `cargo`, `area`, `historialIncidencias`, `nombres`, `cedula`, `apellidos`, `fechaRegreso`, `ultimaActualizacion`, `cohorteInces`, `esNocturno`, `telefono`, `fechaEgreso`) VALUES ('SbMZDUvfbZvchtF9ETz5', '07:00', '', 'NORMAL', '2026-04-23T21:01:57.241Z', NULL, '2006-02-25', '', '', 'almagueralexander839@gmail.com', '16:00', '20202', 'INVECEM', NULL, '', 'Activo (En funciones)', 'Activo', 'coordinador mecanico', 'Mantenimiento', '[]', 'Alexander', '27665305', 'Almaguer', NULL, '2026-05-08T14:13:02.715Z', '', 'false', '04125063044', '');
INSERT INTO `personal` (`id`, `horaEntrada`, `carreraPasante`, `regimenLaboral`, `fechaRegistro`, `fechaFin`, `fechaIngreso`, `fechaInicioCiclo`, `programaInces`, `correo`, `horaSalida`, `ficha`, `tipoPersonal`, `fechaSalida`, `universidadPasante`, `estatus`, `estado`, `cargo`, `area`, `historialIncidencias`, `nombres`, `cedula`, `apellidos`, `fechaRegreso`, `ultimaActualizacion`, `cohorteInces`, `esNocturno`, `telefono`, `fechaEgreso`) VALUES ('V5rFcTxkNfMyXoyrNqYP', '07:00', '', 'NORMAL', '2026-05-25T18:52:19.199Z', NULL, '2018-05-20', '', 'mecanica ', 'samuelk@gmail.com', '16:00', '50502', 'Estudiante INCES', NULL, '', 'Activo (En funciones)', NULL, '', '', '[{"id":1780458289409,"fecha":"2/6/2026, 23:44:49","descripcion":"Inasistencia 2/6/2026 - AUSENCIA TOTAL JORNADA","registradoPor":"SISTEMA AUTOMÁTICO","tipo":"FALTA"},{"id":1780517140785,"descripcion":"Inasistencia 3/6/2026 - JUSTIFICADA","fecha":"3/6/2026, 16:06:08","tipo":"FALTA","registradoPor":"Alexander Almaguer"}]', 'jose', '12457586', 'alama', NULL, '2026-05-28T17:44:31.962Z', '2024-1', 'false', '04125063044', '');
INSERT INTO `personal` (`id`, `horaEntrada`, `carreraPasante`, `regimenLaboral`, `fechaRegistro`, `fechaFin`, `fechaIngreso`, `fechaInicioCiclo`, `programaInces`, `correo`, `horaSalida`, `ficha`, `tipoPersonal`, `fechaSalida`, `universidadPasante`, `estatus`, `estado`, `cargo`, `area`, `historialIncidencias`, `nombres`, `cedula`, `apellidos`, `fechaRegreso`, `ultimaActualizacion`, `cohorteInces`, `esNocturno`, `telefono`, `fechaEgreso`) VALUES ('iUhF6QpuLYMmCAJBLuep', '07:00', 'informatica', 'NORMAL', '2026-06-02T21:46:34.258Z', NULL, '2007-02-20', '', '', 'almagueralexander839@gmail.com', '16:00', '2323', 'Pasante', NULL, 'unerg', 'Activo (En funciones)', NULL, '', '', '[{"fecha":"2/6/2026, 21:31:49","descripcion":"Inasistencia 2/6/2026 - JUSTIFICADA","id":1780450309359,"registradoPor":"active","tipo":"FALTA"}]', 'Alexander', '31554547', 'Almaguer', NULL, '2026-06-03T02:55:45.114Z', '', 'false', '04125063044', '2026-06-03');
INSERT INTO `personal` (`id`, `horaEntrada`, `carreraPasante`, `regimenLaboral`, `fechaRegistro`, `fechaFin`, `fechaIngreso`, `fechaInicioCiclo`, `programaInces`, `correo`, `horaSalida`, `ficha`, `tipoPersonal`, `fechaSalida`, `universidadPasante`, `estatus`, `estado`, `cargo`, `area`, `historialIncidencias`, `nombres`, `cedula`, `apellidos`, `fechaRegreso`, `ultimaActualizacion`, `cohorteInces`, `esNocturno`, `telefono`, `fechaEgreso`) VALUES ('x7I7Mqy3jBgTaZNjqJYB', '07:00', '', 'NORMAL', '2026-04-23T21:03:20.438Z', NULL, '2005-05-20', '', '', 'almagueralexander839@gmail.com', '16:00', '20203', 'INVECEM', NULL, '', 'Activo (En funciones)', 'Activo', 'coordinador mecanico', 'Mantenimiento', '[{"id":1780456642328,"descripcion":"Inasistencia 2/6/2026 - AUSENCIA TOTAL JORNADA","fecha":"2/6/2026, 23:17:22","tipo":"FALTA","registradoPor":"SISTEMA AUTOMÁTICO"}]', 'siry', '21251455', 'pacheco', NULL, '2026-05-08T14:12:16.473Z', '', 'false', '04125063044', '');

-- Tabla: contratistas
DROP TABLE IF EXISTS `contratistas`;
CREATE TABLE `contratistas` (
  `id` TEXT,
  `tipoPersonal` TEXT,
  `idAcceso` TEXT,
  `fechaRegistro` TEXT,
  `areaTrabajo` TEXT,
  `ultimaActualizacion` TEXT,
  `nombreContrata` TEXT,
  `estadoNominal` TEXT,
  `apellidos` TEXT,
  `nombres` TEXT,
  `cedula` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `contratistas` (`id`, `tipoPersonal`, `idAcceso`, `fechaRegistro`, `areaTrabajo`, `ultimaActualizacion`, `nombreContrata`, `estadoNominal`, `apellidos`, `nombres`, `cedula`) VALUES ('3cLD58mljb3g2jsJCQ6l', 'CONTRATISTA', '92333', '2026-03-25T21:03:51.116Z', 'Servicios Generales', '2026-05-21T20:12:45.812Z', 'REPMANT', 'Activo (Acceso Permitido)', 'ALMAGUER', 'ALEXANDER', '9892333');

-- Tabla: asistencias
DROP TABLE IF EXISTS `asistencias`;
CREATE TABLE `asistencias` (
  `id` TEXT,
  `salida` TEXT,
  `area` TEXT,
  `fechaHora` TEXT,
  `cedula` TEXT,
  `estatus` TEXT,
  `cargo` TEXT,
  `estado` TEXT,
  `tipoPersonal` TEXT,
  `entrada` TEXT,
  `nombreCompleto` TEXT,
  `ficha` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `asistencias` (`id`, `salida`, `area`, `fechaHora`, `cedula`, `estatus`, `cargo`, `estado`, `tipoPersonal`, `entrada`, `nombreCompleto`, `ficha`) VALUES ('1ueqdSgM6dYszQF4jwNq', '17:52', 'Mantenimiento', '2026-06-02T21:52:01.943Z', '27665305', 'RETRASO', 'coordinador mecanico', 'FINALIZADO', 'INVECEM', '17:52', 'ALEXANDER ALMAGUER', '20202');
INSERT INTO `asistencias` (`id`, `salida`, `area`, `fechaHora`, `cedula`, `estatus`, `cargo`, `estado`, `tipoPersonal`, `entrada`, `nombreCompleto`, `ficha`) VALUES ('GNJJ3OjdGFIXLvMoMxSp', '17:01', 'Mantenimiento', '2026-05-29T19:02:20.211Z', '27665305', 'RETRASO', 'coordinador mecanico', 'FINALIZADO', 'INVECEM', '15:02', 'ALEXANDER ALMAGUER', '20202');
INSERT INTO `asistencias` (`id`, `salida`, `area`, `fechaHora`, `cedula`, `estatus`, `cargo`, `estado`, `tipoPersonal`, `entrada`, `nombreCompleto`, `ficha`) VALUES ('SZeHX6z8ciYDJu43J0Fy', '14:34', 'Mantenimiento', '2026-06-03T18:32:46.379Z', '27665305', 'RETRASO', 'coordinador mecanico', 'FINALIZADO', 'INVECEM', '14:32', 'ALEXANDER ALMAGUER', '20202');
INSERT INTO `asistencias` (`id`, `salida`, `area`, `fechaHora`, `cedula`, `estatus`, `cargo`, `estado`, `tipoPersonal`, `entrada`, `nombreCompleto`, `ficha`) VALUES ('vbuKDUo5a7CafEHXHIra', '14:45', 'Mantenimiento', '2026-06-03T18:20:56.494Z', '21251455', 'RETRASO', 'coordinador mecanico', 'FINALIZADO', 'INVECEM', '14:20', 'SIRY PACHECO', '20203');

-- Tabla: usuarios
DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `id` TEXT,
  `cargo` TEXT,
  `estado` TEXT,
  `departamento` TEXT,
  `fechaRegistro` TEXT,
  `fechaIngreso` TEXT,
  `uid` TEXT,
  `direccion` TEXT,
  `rol` TEXT,
  `cedula` TEXT,
  `nombres` TEXT,
  `nacionalidad` TEXT,
  `ficha` TEXT,
  `correo` TEXT,
  `telefono` TEXT,
  `fechaNac` TEXT,
  `clave` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `usuarios` (`id`, `cargo`, `estado`, `departamento`, `fechaRegistro`, `fechaIngreso`, `uid`, `direccion`, `rol`, `cedula`, `nombres`, `nacionalidad`, `ficha`, `correo`, `telefono`, `fechaNac`, `clave`) VALUES ('0Kw34KAVzRTC4pTgCwXNJNSQpa52', 'coordinador mecanico', 'Activo', 'mantenimiento', '2026-04-20T02:38:36.036Z', '2005-05-20', '0Kw34KAVzRTC4pTgCwXNJNSQpa52', '', 'Inspector', '27665305', 'Alexander Almaguer', 'Venezolana', '306264', 'ismer@invecem.com', '04125063044', '2004-06-20', NULL);
INSERT INTO `usuarios` (`id`, `cargo`, `estado`, `departamento`, `fechaRegistro`, `fechaIngreso`, `uid`, `direccion`, `rol`, `cedula`, `nombres`, `nacionalidad`, `ficha`, `correo`, `telefono`, `fechaNac`, `clave`) VALUES ('ARRx5mCKwcdSqhAwiMDNQfLxvOm2', 'mecanico', 'Activo', 'mantenimiento', '2026-04-15T21:28:17.149Z', '2006-05-20', 'ARRx5mCKwcdSqhAwiMDNQfLxvOm2', '', 'Proteccion Fisica', '24475159', 'Alexander Almaguer', 'Venezolana', '27853', 'fisica@invecem.com', '04125063044', '2025-06-15', '201980');
INSERT INTO `usuarios` (`id`, `cargo`, `estado`, `departamento`, `fechaRegistro`, `fechaIngreso`, `uid`, `direccion`, `rol`, `cedula`, `nombres`, `nacionalidad`, `ficha`, `correo`, `telefono`, `fechaNac`, `clave`) VALUES ('GRqc6XhjfVQK7Ixf5Pf3RV4YbgH3', 'analista', 'Activo', 'rrhh', '2026-05-18T20:15:37.149Z', '2002-02-20', 'GRqc6XhjfVQK7Ixf5Pf3RV4YbgH3', '', 'Recursos Humanos', '11122702', 'Adrian Almaguer', 'Venezolana', '22702', 'luigi@invecem.com', '0246-4329892', '2006-03-20', NULL);
INSERT INTO `usuarios` (`id`, `cargo`, `estado`, `departamento`, `fechaRegistro`, `fechaIngreso`, `uid`, `direccion`, `rol`, `cedula`, `nombres`, `nacionalidad`, `ficha`, `correo`, `telefono`, `fechaNac`, `clave`) VALUES ('YeGnPhA6BgcGyZ6tdI0tFWHHhZ82', 'almacenista', 'Activo', 'almacen', '2026-04-15T20:34:05.888Z', '2008-02-02', 'YeGnPhA6BgcGyZ6tdI0tFWHHhZ82', '', 'Administrador', '27665305', 'Alexander Almaguer', 'Venezolana', '30626', 'alexander@invecem.com', '45354344444', '2004-06-20', '201980');
INSERT INTO `usuarios` (`id`, `cargo`, `estado`, `departamento`, `fechaRegistro`, `fechaIngreso`, `uid`, `direccion`, `rol`, `cedula`, `nombres`, `nacionalidad`, `ficha`, `correo`, `telefono`, `fechaNac`, `clave`) VALUES ('kkKqE89hDjTDbay65xhXE68WBVB3', 'almacenista', 'Activo', 'mantenimiento', '2026-04-15T21:15:59.799Z', '2005-02-28', 'kkKqE89hDjTDbay65xhXE68WBVB3', '', 'Recursos Humanos', '24475159', 'zoraida orta', 'Venezolana', '27853', 'rrhh@invecem.com', '04125063044', '1970-02-20', '201980');
INSERT INTO `usuarios` (`id`, `cargo`, `estado`, `departamento`, `fechaRegistro`, `fechaIngreso`, `uid`, `direccion`, `rol`, `cedula`, `nombres`, `nacionalidad`, `ficha`, `correo`, `telefono`, `fechaNac`, `clave`) VALUES ('zZhaqWBJMmQutRSoDHueLqNJzs52', 'analista', 'Activo', 'rrhh', '2026-04-16T22:29:34.516Z', '2015-03-20', 'zZhaqWBJMmQutRSoDHueLqNJzs52', '', 'Recursos Humanos', '20878374', 'Adrian Almaguer', 'Venezolana', '20873', 'alex@invecem.com', '0246-4329892', '2001-03-08', NULL);

-- Tabla: auditoria
DROP TABLE IF EXISTS `auditoria`;
CREATE TABLE `auditoria` (
  `id` TEXT,
  `accion` TEXT,
  `rol` TEXT,
  `ip` TEXT,
  `fecha` TEXT,
  `usuario` TEXT,
  `modulo` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('4Wzv2bnvtbv4eAfwQNSA', 'Inicio de sesión exitoso', 'Administrador', '190.120.253.134', '2026-06-03T04:10:56.933Z', 'Invitado', 'Acceso');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('7bAfyVOBUL7y5gfSVhO0', 'Inicio de sesión exitoso', 'Administrador', '190.120.253.134', '2026-06-03T19:11:20.134Z', 'Alexander Almaguer', 'Acceso');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('AiVvP58qnkFLWEwtF56t', 'Intento de inicio de sesión fallido: Credenciales incorrectas', 'Invitado', '190.120.253.134', '2026-06-03T19:31:48.402Z', 'Alexander', 'Acceso');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('B7aE1oVqguTalYpNGQxQ', 'Entrada registrada para Alexander Almaguer (Ficha: 20202) - Estatus: RETRASO', 'administrador', '190.120.253.134', '2026-06-03T18:32:46.834Z', 'Invitado', 'Control de Asistencia');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('DFlZ6YjpuegSKzdxNh15', 'Inicio de sesión exitoso', 'Administrador', '190.120.253.134', '2026-06-03T18:16:30.760Z', 'Invitado', 'Acceso');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('Lh36WXq85dkY9tZHjxIo', 'Inicio de sesión exitoso', 'Administrador', '190.120.253.134', '2026-06-03T19:56:29.493Z', 'Alexander Almaguer', 'Acceso');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('M2J5mbivks8IqWZzgjYr', 'Inicio de sesión exitoso', 'Inspector', '190.120.253.134', '2026-06-03T18:34:02.765Z', 'Alexander Almaguer', 'Acceso');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('MgNUyGdubMgpsNaa4UoN', 'Inicio de sesión exitoso', 'Administrador', '190.120.253.134', '2026-06-03T18:34:38.290Z', 'Alexander Almaguer', 'Acceso');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('OkNVME5Iq0VEABmzQjpa', 'Inicio de sesión exitoso', 'Inspector', '190.120.253.134', '2026-06-03T04:54:15.263Z', 'Invitado', 'Acceso');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('PXwWmTZ6FqXZXzWSNL37', 'Estatus de acceso a planta de contratista cambiado: ALEXANDER ALMAGUER a Activo (Acceso Permitido)', 'administrador', '190.120.253.134', '2026-06-03T20:04:13.840Z', 'Alexander Almaguer', 'Gestión de Contratistas');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('S3wY56EJAsQWzDtssB88', 'Inasistencia marcada para jose alama como JUSTIFICADA', 'administrador', '190.120.253.134', '2026-06-03T20:06:12.248Z', 'Alexander Almaguer', 'Personal Registrado');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('YKn8VDbz4WKwAAjmZUZE', 'Inicio de sesión exitoso', 'Administrador', '190.120.253.134', '2026-06-03T20:31:54.641Z', 'Alexander Almaguer', 'Acceso');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('YrqJuSo30TeRtK7Fd1rt', 'Entrada registrada para siry pacheco (Ficha: 20203) - Estatus: RETRASO', 'administrador', '190.120.253.134', '2026-06-03T18:20:56.959Z', 'undefined', 'Control de Asistencia');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('dQQ44BTjUlRvk5ILame1', 'Estatus de acceso a planta de contratista cambiado: ALEXANDER ALMAGUER a Inactivo', 'administrador', '190.120.253.134', '2026-06-03T20:03:25.173Z', 'Alexander Almaguer', 'Gestión de Contratistas');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('icOpvWuqEyk9JtWNvDFW', 'Inicio de sesión exitoso', 'Administrador', '190.120.253.134', '2026-06-03T04:55:08.578Z', 'Invitado', 'Acceso');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('lKyJPUr68TsDNKdPHO7d', 'Salida registrada para siry pacheco (Ficha: 20203)', 'administrador', '190.120.253.134', '2026-06-03T18:45:21.635Z', 'Alexander Almaguer', 'Control de Asistencia');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('owm6Nf9lPCbCxcUcgMNl', 'Inicio de sesión exitoso', 'Administrador', '190.120.253.134', '2026-06-03T19:54:36.761Z', 'Alexander Almaguer', 'Acceso');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('uPQS7LFhdSXz7MLLYbdy', 'Salida registrada para Alexander Almaguer (Ficha: 20202)', 'inspector', '190.120.253.134', '2026-06-03T18:34:13.290Z', 'Alexander Almaguer', 'Control de Asistencia');
INSERT INTO `auditoria` (`id`, `accion`, `rol`, `ip`, `fecha`, `usuario`, `modulo`) VALUES ('ynH7BwodZ6Llx0MUKO13', 'Inicio de sesión exitoso', 'Administrador', '190.120.253.134', '2026-06-03T19:31:55.814Z', 'Alexander Almaguer', 'Acceso');

-- Tabla: visitantes
DROP TABLE IF EXISTS `visitantes`;
CREATE TABLE `visitantes` (
  `id` TEXT,
  `entrada` TEXT,
  `autoriza` TEXT,
  `motivo` TEXT,
  `empresa` TEXT,
  `nombre` TEXT,
  `fechaIngreso` TEXT,
  `minutosEstancia` TEXT,
  `area` TEXT,
  `salida` TEXT,
  `estado` TEXT,
  `cedula` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `visitantes` (`id`, `entrada`, `autoriza`, `motivo`, `empresa`, `nombre`, `fechaIngreso`, `minutosEstancia`, `area`, `salida`, `estado`, `cedula`) VALUES ('17YjGQy2Xlcr6tv4tY0e', '10:18 a. m.', 'ramon conde', 'inspeccion', 'morrocel', 'alexander', '2026-05-08T14:18:24.472Z', '0', 'Mantenimiento', '10:18 a. m.', 'Finalizado', '30626438');
INSERT INTO `visitantes` (`id`, `entrada`, `autoriza`, `motivo`, `empresa`, `nombre`, `fechaIngreso`, `minutosEstancia`, `area`, `salida`, `estado`, `cedula`) VALUES ('3OwtPoykBwJcQa57tpdk', '04:45 p. m.', 'pedro navas', 'inspeccion', 'repmant', 'alexander', '2026-03-24T20:45:37.287Z', '0', 'Mantenimiento', '04:45 p. m.', 'Finalizado', '30626438');
INSERT INTO `visitantes` (`id`, `entrada`, `autoriza`, `motivo`, `empresa`, `nombre`, `fechaIngreso`, `minutosEstancia`, `area`, `salida`, `estado`, `cedula`) VALUES ('Deq9Oa2UnMunWoaAHo2x', '03:58 p. m.', 'pedro navas', 'inspeccion', 'morrocel', 'alexander', '2026-05-18T20:04:44.942Z', '-6', 'Mantenimiento', '03:59 p. m.', 'Finalizado', '30626438');
INSERT INTO `visitantes` (`id`, `entrada`, `autoriza`, `motivo`, `empresa`, `nombre`, `fechaIngreso`, `minutosEstancia`, `area`, `salida`, `estado`, `cedula`) VALUES ('GktAueUieRqbgfe3ZwS9', '07:36 p. m.', 'pedro navas', 'material', 'mujulu', 'adrian', '2026-03-25T23:36:17.181Z', '0', 'Mantenimiento', '07:36 p. m.', 'Finalizado', '30626438');
INSERT INTO `visitantes` (`id`, `entrada`, `autoriza`, `motivo`, `empresa`, `nombre`, `fechaIngreso`, `minutosEstancia`, `area`, `salida`, `estado`, `cedula`) VALUES ('LNNk26UtKxaMuWabs34Z', '05:45 p. m.', 'adrian almaguer', 'inspección', 'morrocel', 'alexander', '2026-05-25T21:45:58.604Z', '0', 'Administración', '05:46 p. m.', 'Finalizado', '30626438');
INSERT INTO `visitantes` (`id`, `entrada`, `autoriza`, `motivo`, `empresa`, `nombre`, `fechaIngreso`, `minutosEstancia`, `area`, `salida`, `estado`, `cedula`) VALUES ('MokRHOQToYAR86BU1M3U', '03:20 p. m.', 'pedro navas', 'inspeccion', 'morrocel', 'alexander almaguer', '2026-05-11T19:20:17.974Z', '0', 'Producción', '03:20 p. m.', 'Finalizado', '30626438');
INSERT INTO `visitantes` (`id`, `entrada`, `autoriza`, `motivo`, `empresa`, `nombre`, `fechaIngreso`, `minutosEstancia`, `area`, `salida`, `estado`, `cedula`) VALUES ('XjirX1I4eSkHXu0FMFSx', '04:19 p. m.', 'pedro navas', 'visita a la institución', 'retman', 'alexander', '2026-03-24T20:19:59.665Z', '0', 'Administración', '04:20 p. m.', 'Finalizado', '30626438');
INSERT INTO `visitantes` (`id`, `entrada`, `autoriza`, `motivo`, `empresa`, `nombre`, `fechaIngreso`, `minutosEstancia`, `area`, `salida`, `estado`, `cedula`) VALUES ('i3bF9MIwmiV1RjDB8ong', '02:15 p. m.', 'pedro navas', 'busca de material', 'repmat', 'alexander', '2026-03-25T18:15:29.710Z', '0', 'Mantenimiento', '02:15 p. m.', 'Finalizado', '30626438');
INSERT INTO `visitantes` (`id`, `entrada`, `autoriza`, `motivo`, `empresa`, `nombre`, `fechaIngreso`, `minutosEstancia`, `area`, `salida`, `estado`, `cedula`) VALUES ('i9NqmRLwMep3J488CINw', '05:49 p. m.', 'pedro navas', 'inspección', 'morrocel', 'adrian', '2026-05-25T21:49:16.508Z', '1', 'Producción', '05:50 p. m.', 'Finalizado', '30626438');
INSERT INTO `visitantes` (`id`, `entrada`, `autoriza`, `motivo`, `empresa`, `nombre`, `fechaIngreso`, `minutosEstancia`, `area`, `salida`, `estado`, `cedula`) VALUES ('tGNR3YWAT97mEIV5vJ9v', '05:09 p. m.', 'pedro navas', 'inspección', 'retman', 'adrian', '2026-05-11T21:09:17.825Z', '0', 'Mantenimiento', '05:09 p. m.', 'Finalizado', '24475159');
INSERT INTO `visitantes` (`id`, `entrada`, `autoriza`, `motivo`, `empresa`, `nombre`, `fechaIngreso`, `minutosEstancia`, `area`, `salida`, `estado`, `cedula`) VALUES ('tI60i8yk7Djr9dWEQL2y', '07:16 p. m.', 'adiarn almaguer', 'inspeccion', 'morrocel', 'adrian', '2026-05-25T23:16:39.283Z', '0', 'Mantenimiento', '07:17 p. m.', 'Finalizado', '30626438');

-- Tabla: configuracion
DROP TABLE IF EXISTS `configuracion`;
CREATE TABLE `configuracion` (
  `id` TEXT,
  `pinMaestro` TEXT,
  `claveExpedientes` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `configuracion` (`id`, `pinMaestro`, `claveExpedientes`) VALUES ('seguridad', '202020', '201980');

