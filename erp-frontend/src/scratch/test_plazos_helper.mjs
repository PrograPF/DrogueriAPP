import { evaluarPlazos, validarOrdenFechas, addDaysISO, formatISOToDisplay } from '../utils/plazosHelper.js';

let fails = 0;
const check = (name, cond) => { console.log(`${cond ? '✅' : '❌'} ${name}`); if (!cond) fails++; };

const env = { estado: 'Enviada', fecha_tope_aceptacion: '2026-10-19' };
check('Enviada 17/10 → ok', evaluarPlazos(env, '2026-10-17').nivel === 'ok');
check('Enviada 18/10 → amarillo', evaluarPlazos(env, '2026-10-18').nivel === 'amarillo');
check('Enviada 19/10 → amarillo', evaluarPlazos(env, '2026-10-19').nivel === 'amarillo');
check('Enviada 20/10 → rojo', evaluarPlazos(env, '2026-10-20').nivel === 'rojo');

const ac = { estado: 'Aceptada', fecha_tope_entrega: '2026-10-25', fecha_tope_multa: '2026-10-30' };
const exp = { '2026-10-23': 'ok', '2026-10-24': 'amarillo', '2026-10-25': 'amarillo', '2026-10-26': 'multa',
  '2026-10-28': 'multa', '2026-10-29': 'naranjo', '2026-10-30': 'naranjo', '2026-10-31': 'rojo' };
for (const [d, n] of Object.entries(exp)) check(`Aceptada ${d} → ${n}`, evaluarPlazos(ac, d).nivel === n);
check('Aceptada 26/10 glosa multa', evaluarPlazos(ac, '2026-10-26').glosa.includes('Atrasado con multa'));
check('isOrange en multa', evaluarPlazos(ac, '2026-10-27').isOrange === true);

check('Aceptada sin tope multa 27/10 → multa', evaluarPlazos({ estado: 'Aceptada', fecha_tope_entrega: '2026-10-25' }, '2026-10-27').nivel === 'multa');
check('Enviada sin fecha → sin_fecha', evaluarPlazos({ estado: 'Enviada' }, '2026-10-20').nivel === 'sin_fecha');
check('Aceptada sin fecha → sin_fecha', evaluarPlazos({ estado: 'Aceptada' }, '2026-10-20').nivel === 'sin_fecha');
check('Cancelado → final', evaluarPlazos({ estado: 'Cancelado', fecha_tope_aceptacion: '2026-01-01' }, '2026-10-20').nivel === 'final');
check('Recepción Conforme → final', evaluarPlazos({ estado: 'Recepción Conforme' }).nivel === 'final');
check('Fecha con hora (ISO) normaliza', evaluarPlazos({ estado: 'Enviada', fecha_tope_aceptacion: '2026-10-19T00:00:00+00:00' }, '2026-10-20').nivel === 'rojo');

check('addDays fin de mes', addDaysISO('2026-10-31', 1) === '2026-11-01');
check('addDays -1 inicio de mes', addDaysISO('2026-11-01', -1) === '2026-10-31');
check('format', formatISOToDisplay('2026-10-19') === '19/10/2026');
check('valida ok', validarOrdenFechas({ fecha_tope_aceptacion: '2026-10-19', fecha_tope_entrega: '2026-10-25', fecha_tope_multa: '2026-10-30' }) === null);
check('valida parcial ok', validarOrdenFechas({ fecha_tope_entrega: '2026-10-25' }) === null);
check('valida acept > entrega', validarOrdenFechas({ fecha_tope_aceptacion: '2026-10-26', fecha_tope_entrega: '2026-10-25' }) !== null);
check('valida entrega > multa', validarOrdenFechas({ fecha_tope_entrega: '2026-10-31', fecha_tope_multa: '2026-10-30' }) !== null);

console.log(fails === 0 ? '\nTODAS LAS PRUEBAS PASARON' : `\n${fails} PRUEBA(S) FALLARON`);
process.exit(fails ? 1 : 0);
