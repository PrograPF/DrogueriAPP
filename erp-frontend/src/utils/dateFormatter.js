export const formatDate = (dateInput) => {
  if (!dateInput) return '';
  try {
    // Si es una fecha pura de base de datos YYYY-MM-DD (ej: '2026-05-18')
    // la formateamos directamente para evitar desfases por diferencias de zona horaria
    if (typeof dateInput === 'string' && dateInput.includes('-') && !dateInput.includes('T')) {
      const [year, month, day] = dateInput.split('-');
      return `${day.substring(0, 2)}/${month}/${year}`;
    }

    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (err) {
    return String(dateInput);
  }
};

export const formatDateTime = (dateInput) => {
  if (!dateInput) return '';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} a las ${hours}:${minutes}`;
  } catch (err) {
    return String(dateInput);
  }
};

