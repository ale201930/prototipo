/**
 * pdf-generator.js
 * Carga jsPDF + autoTable desde CDN en tiempo de ejecución para evitar
 * cualquier conflicto con el bundler de Turbopack/SSR.
 */

function cargarScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') { reject(new Error('No browser')); return; }
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Error cargando ${src}`));
    document.head.appendChild(s);
  });
}

export async function generarPDFAuditoria(agrupadosPorDia, registrosFiltrados) {
  // Cargar jsPDF 2.5.1 y autoTable 3.8.4 desde CDN (versiones estables)
  await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js');

  // jsPDF UMD expone window.jspdf
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // ── Encabezado oscuro
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('INVECEM \u2014 Auditor\u00eda del Sistema', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generado el ${new Date().toLocaleString('es-VE')}  |  Total: ${registrosFiltrados.length} registros`,
    14,
    21
  );

  let startY = 32;

  for (const grupo of agrupadosPorDia) {
    // Etiqueta del día
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(grupo.diaLabel, 14, startY + 5);

    const filas = grupo.registros.map((r) => [
      r.fechaFormateada.split(' ')[1] || '\u2014',
      r.usuario || '\u2014',
      r.rol || '\u2014',
      r.accion || '\u2014',
      r.modulo || '\u2014',
      r.accion?.toLowerCase().includes('fallido') ? 'Fallo' : '\u00c9xito',
      r.ip || '\u2014',
    ]);

    doc.autoTable({
      startY: startY + 8,
      head: [['HORA', 'USUARIO', 'ROL', 'ACCI\u00d3N', 'M\u00d3DULO', 'ESTADO', 'IP']],
      body: filas,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, font: 'helvetica', textColor: [30, 41, 59] },
      headStyles: {
        fillColor: [239, 68, 68],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: {
        0: { cellWidth: 22 },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 30, font: 'courier' },
      },
      didParseCell: (data) => {
        if (data.column.index === 5 && data.section === 'body') {
          const esFallo = data.cell.raw === 'Fallo';
          data.cell.styles.textColor = esFallo ? [220, 38, 38] : [22, 163, 74];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 14, right: 14 },
    });

    startY = doc.lastAutoTable.finalY + 10;

    if (startY > 185) {
      doc.addPage();
      startY = 14;
    }
  }

  doc.save(`auditoria_invecem_${new Date().toISOString().slice(0, 10)}.pdf`);
}
