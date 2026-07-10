import type { Technician } from '../domain/types';

const importedAt = new Date().toISOString();

const records = [["José Jimenez Navarro","Mecánicos"],["Victor Rodríguez Rivero","Mecánicos"],["Angel Hinojosa Lucena","Mecánicos"],["Benjamín Vargas Quesada","Mecánicos"],["Juan Narvaez Soto","Mecánicos"],["Alfonso Alcudia García","Mecánicos"],["J. Luis Vico Mochon","Mecánicos"],["Evaristo Molina Ibáñez","Mecánicos"],["Miguel Rodríguez Morales","Mecánicos"],["S. Salvatierra Montosa","Mecánicos"],["Juan Pablo García Puga","Electricistas"],["José Rodríguez Yeste","Electricistas"],["M. A. A. López Esteban","Electricistas"],["Roberto Alfonso Fagundez","Electricistas"],["José A. Franco Mingorance","Electricistas"],["Alberto Puig Ruiz","Electricistas"],["Carlos González De Porras","Electricistas"],["Luis Solana Prieto","Electricistas"],["Jesús A. Salado Fernández","Electricistas"],["Juan Antonio Serrano Almagro","Electricistas"],["J. A. Martínez De La Torre","Electricistas"],["José Dengra Chillon","Electricistas"],["David Fernando Alberolas Baños","Electricistas"],["Sergio Iván Raez Martínez","Fontaneros"],["Sinuhe Bailón Bailón","Fontaneros"],["Carlos García Espinosa","Fontaneros"],["Miguel López Del Aguila","Fontaneros"],["Jonathan Ortega Robles","Fontaneros"],["Angela M. Gonzalez Gonzalez","Fontaneros"],["Isicio Zafra Cantos","Fontaneros"],["Angel Ant. Sánchez Rojas","Fontaneros"],["David Segura Jimenez","Fontaneros"],["Oscar Rodríguez Torres","Fontaneros"],["Antonio Megias Ruiz","Fontaneros"],["Juan Manuel Arguelles Barea","Fontaneros"],["Marcos Gordo Jose Antonio","Fontaneros"],["Adriano Rios Serrano","Fontaneros"],["David Salinas Rodriguez","Fontaneros"],["David Moreno Vico","Calefactores"],["David Fernandez Fructuoso","Calefactores"],["Celestino Morente Moreno","Calefactores"],["Fernando R. Fdez Garcia","Calefactores"],["José Alberto Gutierrez Silles","Calefactores"],["Ignacio Medialdea León","Calefactores"],["José Tortosa Hita","Calefactores"],["David García Alonso","Calefactores"],["Antonio López Velasco","Calefactores"],["Javier Repiso García","Calefactores"],["Carlos Rodríguez Martínez","Centro de Control"],["José Rodríguez Balderas","Centro de Control"],["Rafael Quesada Hervas","Centro de Control"],["José Cuesta Carrasco","Centro de Control"],["José A. Rosales Rodríguez","Centro de Control"],["María Eugenia Ruiz López","Centro de Control"],["Álvaro Moreno Marquez","Centro de Control"],["M. C. Espejo Ruiz","Pintores"],["Luis Ruiz Vega","Pintores"],["Martina Inés Martín Martín","Pintores"],["Marcelo Fdez. Cámara","Pintores"],["Inmaculada Lucena Prieto","Pintores"],["Benjamín Cortes Álvarez","Jardineros"],["Omar Romo Sola","Jardineros"],["Miguel Puerta Valdivia","Albañiles"],["Juan Ramón Melguizo Conejero","Albañiles"],["Antonio Arias Santiago","Almacén Mant."],["Eduardo Rodríguez Portes","T.E. Refuerzo"],["David Garcia Ruiz","T.E. Refuerzo"],["Ramón Moya Castilla","Carpinteros"],["Francisco Sierra Sierra","Carpinteros"],["Jose I. Fernández Machado","Carpinteros"],["Francisco Moreno Fernández","Peones"],["José Martín Hernández","Peones"],["Antonio Ocon Burgos","Peones"],["Rafael Vallejo Torres","Peones"],["Santiago Maldonado Muros","Peones"],["Miguel Rufino Bueno","Peones"]] as const;

export const hospitalTechnicians: Technician[] = records.map(([name, specialty], index) => ({
  id: `tech-${String(index + 1).padStart(3, '0')}-${name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`,
  code: `TEC-${String(index + 1).padStart(3, '0')}`,
  name,
  specialty,
  active: true,
  createdAt: importedAt,
  updatedAt: importedAt,
}));

export const technicianSpecialties = Array.from(
  new Set(hospitalTechnicians.map((technician) => technician.specialty)),
);
