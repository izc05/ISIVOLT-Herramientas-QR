import type { Technician } from '../domain/types';

const importedAt = new Date().toISOString();

const source = `name	specialty	role	phone	extension	previousPhone	email
José Jimenez Navarro	Mecánicos	Técnico Mecánico	697958917	758917		jose.jimenez.navarro.sspa@juntadeandalucia.es
Victor Rodríguez Rivero	Mecánicos	Técnico Mecánico	662480286	620286		victor.rodriguez.rivero.sspa@juntadeandalucia.es
Angel Hinojosa Lucena	Mecánicos	Técnico Mecánico	671594575	694575		josea.hinojosa.sspa@juntadeandalucia.es
Benjamín Vargas Quesada	Mecánicos	Técnico Mecánico	671561949	761949		benjamin.vargas.sspa@juntadeandalucia.es
Juan Narvaez Soto	Mecánicos	Técnico Mecánico	671597594	697594		juanf.narvaez.sspa@juntadeandalucia.es
Alfonso Alcudia García	Mecánicos	Técnico Mecánico	671563526	763526		alfonsoj.alcudia.sspa@juntadeandalucia.es
J. Luis Vico Mochon	Mecánicos	Técnico Mecánico	671561680	761680		josel.vico.sspa@juntadeandalucia.es
Evaristo Molina Ibáñez	Mecánicos	Técnico Mecánico	671592932	692932		evaristo.molina.sspa@juntadeandalucia.es
Miguel Rodríguez Morales	Mecánicos	Técnico Mecánico	697958464	758464		miguel.rodriguez.sspa@juntadeandalucia.es
S. Salvatierra Montosa	Mecánicos	Técnico Mecánico	671561712	761712		salvador.salvatierra.sspa@juntadeandalucia.es
Juan Pablo García Puga	Electricistas	Técnico Electricista	690864543	621260		juanp.garcia.puga.sspa@juntadeandalucia.es
José Rodríguez Yeste	Electricistas	Técnico Electricista	686651697	651258		jose.rodriguez.yeste.sspa@juntadeandalucia.es
M. A. A. López Esteban	Electricistas	Técnico Electricista	671562594	762594		jose.rodriguez.yeste.sspa@juntadeandalucia.es
Roberto Alfonso Fagundez	Electricistas	Técnico Electricista	671561696	761696		roberto.alfonso.sspa@juntadeandalucia.es
José A. Franco Mingorance	Electricistas	Técnico Electricista	697956944	756944		josea.franco.mingorance.sspa@juntadeandalucia
Alberto Puig Ruiz	Electricistas	Técnico Electricista	671568068	768068		alberto.puig.sspa@juntadeandalucia.es
Carlos González de Porras	Electricistas	Técnico Electricista	671592054	692054		carlos.gonzalez.porras.sspa@juntadeandalucia.es
Luis Solana Prieto	Electricistas	Técnico Electricista	677902634	732634		lalberto.solana.sspa@juntadeandalucia.es
Jesús A. Salado Fernández	Electricistas	Técnico Electricista		650582		jalberto.salado.sspa@juntadeandalucia.es
Juan Antonio Serrano Almagro	Electricistas	Técnico Electricista	671561852	761852		juan.serrano.almagro.sspa@juntadeandalucia.es
J. A. Martínez de la Torre	Electricistas	Técnico Electricista	671562085	762085		javier.martinez.torre.sspa@juntadeandalucia.es
José Dengra Chillon	Electricistas	Técnico Electricista	677904467	734467		josea.dengra.sspa@juntadeandalucia.es
David Fernando Alberolas Baños	Electricistas	Técnico Electricista	626784403	698891		davidf.alberola.sspa@juntadeandalucia.es
Sergio Iván Raez Martínez	Fontaneros	Técnico Fontanero	697104692	674692		sergioi.raez.sspa@juntadeandalucia.es
Sinuhe Bailón Bailón	Fontaneros	Técnico Fontanero	650238331	695626		sinuhe.bailon.sspa@juntadeandalucia.es
Carlos García Espinosa	Fontaneros	Técnico Fontanero		762587		carlosj.garcia.espinosa.sspa@juntadeandalucia.es
Miguel López del Aguila	Fontaneros	Técnico Fontanero	697958893	758893		
Jonathan Ortega Robles	Fontaneros	Técnico Fontanero	697104692	674692		jonathan.ortega.sspa@juntadeandalucia.es
Angela M. Gonzalez Gonzalez	Fontaneros	Técnico Fontanero	671561945	761945		angelam.gonzalez.gonzalez.sspa@juntadeandalucia.es
Isicio Zafra Cantos	Fontaneros	Técnico Fontanero	616769892	661793		isicio.zafra.sspa@juntadeandalucia.es
Angel Ant. Sánchez Rojas	Fontaneros	Técnico Fontanero	671561686	761686		aantonio.sanchez.sspa@juntadeandalucia.es
David Segura Jimenez	Fontaneros	Técnico Fontanero		637502		david.segura.sspa@juntadeandalucia.es
Oscar Rodríguez Torres	Fontaneros	Técnico Fontanero	697958473	758473		oscar.rodriguez.torres.sspa@juntadeandalucia.es
Antonio Megias Ruiz	Fontaneros	Técnico Fontanero	616769892	661793		david.segura.sspa@juntadeandalucia.es
Juan Manuel Arguelles Barea	Fontaneros	Técnico Fontanero	671561821	761821		juanm.arguelles.sspa@juntadeandalucia.es
Marcos Gordo Jose Antonio	Fontaneros	Técnico Fontanero	697953440	753440		josea.marcos.sspa@juntadeandalucia.es
Adriano Rios Serrano	Fontaneros	Técnico Fontanero	671561823	761823		adriano.rios.sspa@juntadeandalucia.es
David Salinas Rodriguez	Fontaneros	Técnico Fontanero	697953440	753440		david.salinas.sspa@juntadeandalucia.es
David Moreno Vico	Calefactores	Técnico Calefactor	662480305	620305		david.moreno.vico.sspa@juntadeandalucia.es
David Fernandez Fructuoso	Calefactores	Técnico Calefactor	608734915	698105		david.fernandez.fructuoso.sspa@juntadeandalucia.es
Celestino Morente Moreno	Calefactores	Técnico Calefactor	629889782	665486		celestino.morente.sspa@juntadeandalucia.es
Fernando R. Fdez Garcia	Calefactores	Técnico Calefactor	671561771	761771		fernando.garcia.garcia.sspa@juntadeandalucia.es
José Alberto Gutierrez Silles	Calefactores	Técnico Calefactor	628942998	697843		jalberto.gutierrez.sspa@juntadeandalucia.es
Ignacio Medialdea León	Calefactores	Técnico Calefactor	671561779	761779		ignacio.medialdea.sspa@juntadeandalucia.es
José Tortosa Hita	Calefactores	Técnico Calefactor	671560155	760155		jose.tortosa.hita.sspa@juntadeandalucia.es
David García Alonso	Calefactores	Técnico Calefactor	626408293	621259		david.garcia.alonso.sspa@juntadeandalucia.es
Antonio López Velasco	Calefactores	Técnico Calefactor	671562301	762301		antoniom.lopez.velasco.sspa@juntadeandalucia.es
Javier Repiso García	Calefactores	Técnico Calefactor	670945151	745151		franciscoj.repiso.sspa@juntadeandalucia.es
Carlos Rodríguez Martínez	Centro de Control	Operador Control	671561683	761683		carlos.rodriguez.martinez.sspa@juntadeandalucia.es
José Rodríguez Balderas	Centro de Control	Operador Control	671561824	761824		jose.rodriguez.balderas.sspa@juntadeandalucia.es
Rafael Quesada Hervas	Centro de Control	Operador Control	697104677	674677		rafael.quesada.sspa@juntadeandalucia.es
José Cuesta Carrasco	Centro de Control	Operador Control	671561824	761946		jose.cuesta.sspa@juntadeandalucia.es
José A. Rosales Rodríguez	Centro de Control	Operador Control	671561825	761825		
María Eugenia Ruiz López	Centro de Control	Operador Control	697957211	757211		eugenia.ruiz.sspa@juntadeandalucia.es
Álvaro Moreno Marquez	Centro de Control	Operador Control	618144338	697925		alvaro.moreno.sspa@juntadeandalucia.es
M. C. Espejo Ruiz	Pintores	Técnico Pintor	650186473	662262		maria.espejo.sspa@juntadeandalucia.es
Luis Ruiz Vega	Pintores	Técnico Pintor	670094465	744465		luis.ruiz.vega.sspa@juntadeandalucia.es
Martina Inés Martín Martín	Pintores	Técnico Pintor	639220072	635112		martinai.martin.sspa@juntadeandalucia.es
Marcelo Fdez. Cámara	Pintores	Técnico Pintor	697953861	753861		marcelo.fernandez.sspa@juntadeandalucia.es
Inmaculada Lucena Prieto	Pintores	Técnico Pintor	636528307	732010		inmaculada.lucena.prieto.sspa@juntadeandalucia.es
Benjamín Cortes Álvarez	Jardineros	Técnico Jardinero	689027621	696993		benjamin.cortes.sspa@juntadeandalucia.es
Omar Romo Sola	Jardineros	Técnico Jardinero	628942998	697843		omar.romo.sspa@juntadeandalucia.es
Miguel Puerta Valdivia	Albañiles	Técnico Albañil		612766		miguel.puerta.sspa@juntadeandalucia.es
Juan Ramón Melguizo Conejero	Albañiles	Técnico Albañil	677903178	733178		juanr.melguizo.sspa@juntadeandalucia.es
Antonio Arias Santiago	Almacén Mant.	Almacenero	671598813	698813		josea.arias.sspa@juntadeandalucia.es
Eduardo Rodríguez Portes	T.E. Refuerzo	Técnico Especialista	677905241	765241		eduardo.rodriguez.portes.sspa@juntadeandalucia.es
David Garcia Ruiz	T.E. Refuerzo	Técnico Especialista	671564234	764234		david.garcia.ruiz.sspa@juntadeandalucia.es
Ramón Moya Castilla	Carpinteros	Técnico Carpintero				ramon.moya.sspa@juntadeandalucia.es
Francisco Sierra Sierra	Carpinteros	Técnico Carpintero	639160184	621257		francisco.sierra.sierra.sspa@juntadeandalucia.es
Jose I. Fernández Machado	Carpinteros	Técnico Carpintero	696440862	697554		jose.fernandez.sspa@juntadeandalucia.es
Francisco Moreno Fernández	Peones	Peón	650238331	695626		francisco.moreno.fernandez.sspa@juntadeandalucia.es
José Martín Hernández	Peones	Peón	639417646	668467		jose.martin.hernandez.sspa@juntadeandalucia.es
Antonio Ocon Burgos	Peones	Peón	696398153	668466		antonio.ocon.sspa@juntadeandalucia.es
Rafael Vallejo Torres	Peones	Peón	626828063	699850		rafael.vallejo.sspa@juntadeandalucia.es
Santiago Maldonado Muros	Peones	Peón	697954694	754694		santiago.maldonado.muros.sspa@juntadeandalucia.es
Miguel Rufino Bueno	Peones	Peón	671561840	698813		miguel.rufino.bueno.sspa@juntadeandalucia.es`;

const rows = source.split('\n').slice(1).map((line) => {
  const [name, specialty, role, phone, extension, previousPhone, email] = line.split('\t');
  return { name, specialty, role, phone, extension, previousPhone, email };
});

export const hospitalTechnicians: Technician[] = rows.map((record, index) => ({
  id: `tech-${String(index + 1).padStart(3, '0')}-${record.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`,
  code: `TEC-${String(index + 1).padStart(3, '0')}`,
  name: record.name,
  specialty: record.specialty,
  role: record.role || undefined,
  phone: record.phone || undefined,
  extension: record.extension || undefined,
  previousPhone: record.previousPhone || undefined,
  email: record.email || undefined,
  active: true,
  createdAt: importedAt,
  updatedAt: importedAt,
}));

export const technicianSpecialties = Array.from(
  new Set(hospitalTechnicians.map((technician) => technician.specialty)),
);
