/* ------------------------------------------------------------------
   ÚNICO ARCHIVO QUE HAY QUE TOCAR PARA PERSONALIZAR LA APP.
   Todo lo demás funciona sin cambiar una línea de código.
   ------------------------------------------------------------------ */
window.CONFIG = {

  /* Nombre que aparece en la cabecera y en la primera hoja del Excel. */
  MARCA: 'Celta Fortuna · Goles encajados',

  /* Porteros que entrenas. El primero sale preseleccionado.
     Añade o quita nombres entre comillas, separados por comas.
     También se pueden añadir desde la propia app (desplegable Portero →
     «+ Añadir portero…»). Lista de partida: porteros del Celta Fortuna
     en la temporada 2025/26 según BeSoccer; confirma los de esta temporada. */
  PORTEROS: ['Coke Carrillo', 'Caio Barone', 'Quique Ribes', 'M. González'],

  /* Equipos / categorías. Si solo trabajas con uno, deja uno. */
  EQUIPOS: ['Celta Fortuna'],

  /* Rivales del desplegable. Segunda División 2026/27 (LaLiga Hypermotion):
     los 21 equipos además del Celta Fortuna. Si juega otro rival (Copa,
     amistoso), en la app hay «+ Otro rival…». */
  RIVALES: [
    'Albacete', 'Almería', 'Andorra', 'Burgos', 'Cádiz', 'Castellón', 'Ceuta',
    'Córdoba', 'Eibar', 'Eldense', 'Girona', 'Granada', 'Las Palmas', 'Leganés',
    'Mallorca', 'Real Oviedo', 'Real Sociedad B', 'Sabadell', 'Sporting de Gijón',
    'Tenerife', 'Real Valladolid'
  ],

  /* Jornadas que tiene la liga: hasta la mitad es Primera Vuelta y a partir
     de ahí Segunda Vuelta. En Segunda División son 42. */
  JORNADAS: 42,

  /* Jugadores de cada rival, para el desplegable de goleador / asistente.
     Escribe el nombre del equipo tal cual está en RIVALES y los jugadores
     entre comillas. Los nombres que el entrenador escriba en la app también
     se recuerdan para ese rival sin tocar este archivo. Ejemplo:
       'Albacete': ['Jugador 1', 'Jugador 2'],
  */
  JUGADORES: {
    /* Plantillas de LaLiga Hypermotion 2026/27 cargadas el 19/10/2026 (fuentes:
       webs de los clubes, BeSoccer, Wikipedia). Cambian en el mercado de
       invierno: lo que el entrenador escriba en la app también se recuerda. */
    'Albacete': ['Carlos Marín', 'Lorenzo Aguado', 'Agus Medina', 'Javi Moreno', 'Antonio Pacheco', 'Antonio Puertas', 'Javi Villar', 'Mario Soberón', 'Róber González', 'Víctor Valverde', 'Higinio Marín', 'Diego Mariño', 'Víctor San Bartolomé', 'Fran Gámez', 'Munir El Haddadi', 'José Corpas', 'Sergio Ortuño', 'Álex Rubio', 'Samu Obeng', 'Carlos Neva', 'Lluís López', 'Pepe Sánchez', 'Jesús Vallejo', 'Capi', 'Dani Bernabéu', 'Toni Velilla', 'Agustín Albarracín', 'Tomás Inglés', 'Diego Rodríguez', 'Fabio García-Moreno', 'Antonio David'],
    'Almería': ['Andrés Fernández', 'Marcos Luna', 'Álex Muñoz', 'Jorge Pulido', 'Mikel Vesga', 'Jon Morcillo', 'Gui Guedes', 'Thalys', 'Nico Melamed', 'Sergio Arribas', 'Léo Baptistão', 'Fernando', 'Javi Muñoz', 'Leonardo Lelo', 'Brian Cipenga', 'Federico Bonini', 'Rodrigo Ely', 'Álex Sola', 'Chumi', 'Daijiro Chirino', 'Adri Embarba', 'Miguel de la Fuente', 'Stefan Džodić', 'Áron Yaakobishvili', 'Quim Junyent'],
    'Andorra': ['Nico Ratti', 'Juan Sebastián Serrano', 'Lautaro Spatz', 'Gael Alonso', 'Marc Bombardó', 'Hugo Solozábal', 'Álex Calvo', 'Efe Akman', 'Julian Rijkhoff', 'Marc Domènech', 'Lautaro de León', 'Pau López', 'Sergio Molina', 'Jordi Cano', 'Randy Schneider', 'Thomas Carrique', 'Andoni López', 'Nacho Quintana', 'Martí Vilà', 'Moró Sidibe', 'Diego Alende', 'Théo Le Normand', 'Jesús Owono', 'Stefan Golubović', 'Tiago Olmedo', 'Hugo López', 'Jan Lagunas', 'Jordi Toribio', 'Enes Sali'],
    'Burgos': ['Bruno Iribarne', 'Álex Lizancos', 'Ignasi Vilarrasa', 'Pablo Galdames', 'Marcelo Expósito', 'Sergio González', 'Jon Karrikaburu', 'Grego Sierra', 'Álex Forés', 'Kévin Appin', 'Víctor Mollejo', 'Unai Vencedor', 'Ander Cantero', 'David González', 'Oier Luengo', 'Curro Sánchez', 'Mario Cantero', 'Saúl del Cerro', 'Javi Llabrés', 'José Gragera', 'Fermín García', 'Brais Martínez', 'Alberto Dadie', 'Santiago Lencina', 'Marc Monedero', 'Irian Ribas', 'Diego González', 'Iván Martínez', 'Cristian Torrelavid', 'David Hernáiz'],
    'Castellón': ['Amir Saipi', 'Juanjo Nieto', 'Fabrizio Brignani', 'Agustín Sienra', 'Alberto Jiménez', 'Matías Orozco', 'Raúl Sánchez', 'Barri', 'Ousmane Camara', 'Israel Suero', 'Federico Ceccherini', 'Lucas Alcázar', 'Romain Matthys', 'Iñigo Córdoba', 'Ilias Kostis', 'Adam Jakobsen', 'Fran Castillo', 'Pablo Santiago', 'Hamza Bellari', 'Tincho Conde', 'Álvaro Martín', 'Jérémy Mellot', 'Álvaro García', 'David Nzanza', 'Jari Vlak', 'Rodrigo Rêgo', 'Antonio Gala', 'Michal Willmann', 'Sergi Torner'],
    'Celta Fortuna': ['Coke Carrillo', 'Pablo Gavián', 'Quique Ribes', 'S. Ndiaye', 'Hugo Burcio', 'Pablo Meixús', 'B. Somuah', 'Andrés Antañón', 'Álvaro Marín', 'Óscar Marcos', 'Angelito', 'Caio Barone', 'Jan Oliveras', 'A. Kibet', 'Adrià Capdevila', 'Hugo Cuenca', 'Joel López', 'Á. Dávila', 'Anxo Rodríguez', 'Alexis Olmedo', 'Stefan Bajčetić', 'Germain Miller', 'M. González', 'J. Pérez-Lafuente', 'N. Rodríguez', 'Vladimir Silva', 'M. Sobral', 'R. Chirveches', 'H. López', 'D. Sueiro', 'Anthony Khayat'],
    'Ceuta': ['Pedro López', 'Toni Abad', 'José Matos', 'Albert Caparrós', 'Adrián Lapeña', 'Carlos Hernández', 'Álex Camacho', 'Kuki Zalazar', 'Jordi Escobar', 'Marino Illescas', 'Cedric Teguia', 'Guille Vallejo', 'Yann Bodiger', 'Joaquín González', 'Redru', 'Mawuli Mensah', 'Álex Petxarroman', 'Edgar Sevikyan', 'Ale Meléndez', 'Kenneth Mamah', 'Kialy Abdoul Koné', 'Anuar Tuhami', 'Víctor Corral', 'Arick Betancourt', 'Umaru Konaré', 'Abraham Bueno', 'Omar Sadik', 'Adrián Romero', 'Gabriel Okoro', 'Dani Mas', 'Josemi'],
    'Cádiz': ['David Gil', 'Beñat de Jesús', 'Sergio Arribas', 'Javi Castro', 'Marc-Olivier Doué', 'Manu Fernández', 'Iuri Tabatadze', 'Efe Aghama', 'Álvaro García Pascual', 'Javi Ontiveros', 'José Antonio de la Rosa', 'Giorgi Gocholeishvili', 'Jokin Ezkieta', 'Bojan Kovačević', 'Kenan Toibibou', 'Antonio Cordero', 'Aïmen Moueffek', 'Jandro Orellana', 'Urko Izeta', 'Borja Vázquez', 'Vladys Kopotun', 'Cristian Gutiérrez', 'Damián Rodríguez', 'Ibon Sánchez', 'Gonzalo Petit', 'Rubén Domínguez', 'Juan Díaz', 'Dilan Zárate'],
    'Córdoba': ['Iker Álvarez', 'Tasende', 'Álex Martín', 'Juan Gutiérrez', 'Damián Cáceres', 'Théo Zidane', 'Isma Ruiz', 'Diego Percan', 'Kevin Medina', 'Diego Bri', 'Franck Fomeyem', 'Guilherme', 'A. Ghailan', 'V. Sánchez', 'Rubén Alves', 'Adilson', 'Enol', 'Ibai Sanz', 'Nélson Monte', 'Carlos Albarrán', 'Yussi Diarra', 'Cristian Carracedo', 'Salim El Jebari', 'Alex Arévalo', 'Egoitz Muñoz', 'Eder García', 'Jacobo Martí', 'Dani Budesca', 'Álex López'],
    'Eibar': ['Luis López', 'Sergio Cubero', 'Imanol García de Albéniz', 'Unai Elgezabal', 'Peru Nolaskoain', 'Sergio Álvarez', 'Adu Ares', 'Ander Madariaga', 'Jon Bautista', 'Jon Guruzeta', 'Jon Magunazelaia', 'Jonmi Magunagoitia', 'Lander Olaetxea', 'Jair Amador', 'Pejiño', 'Markel Arana', 'Eric Pérez', 'Javi Martón', 'Iván Gil', 'Álvaro Rodríguez', 'Anaitz Arbilla', 'Juan Bernat', 'Aleix Garrido', 'Carlos Lumbreras'],
    'Eldense': ['Ramon Vila', 'Iker Recio', 'Juan Larios', 'Floris Smand', 'Álex Serra', 'Borja Calvo', 'Jorge Rastrojo', 'Marcos Bustillo', 'Mariano Carmona', 'Fidel Chaves', 'Manu Nieto', 'Roberto López', 'Juan Palomares', 'Justin Smith', 'Carlos Guirao', 'Pau Cabanes', 'Jesús Clemente', 'Guille Macho', 'Alejandro Ibarrondo', 'Waldo Rubio', 'David Ruiz', 'Julien Yanda', 'Jordi Martín', 'Javi Martínez', 'Iker Carbonell', 'Cristian Amarillo', 'Dinis Rodrigues', 'David Rodríguez', 'Antonio David', 'Aingeru Olabarrieta', 'Javier Olaizola', 'David Bernabéu'],
    'Girona': ['Sergi Puig', 'Abdul Mumin', 'Mateu Morey', 'Javier Boñar', 'David López', 'Donny van de Beek', 'Cristhian Stuani', 'Fran Beltrán', 'Abel Ruiz', 'Portu', 'Álex Moreno', 'Paulo Gazzaniga', 'Iván Morante', 'Oleksandr Pyshchur', 'Alejandro Francés', 'Bryan Gil', 'Vladyslav Vanat', 'Jastin García', 'Yáser Asprilla', 'Carles Pérez', 'Izan González', 'Vladyslav Krapyvtsov', 'Lass Kourouma', 'Unai Hernández', 'Antonio Salguero', 'Mauro Furtado', 'Holmes Zamorano'],
    'Granada': ['Alberto Flores', 'Pau Casadesús', 'Diego Hormigo', 'Rubén Alcaraz', 'Manu Lama', 'Gerard Gumbau', 'Sergio Rodelas', 'Pedro Alemañ', 'Alejandro Marqués', 'Jorge Pascual', 'José Arnáiz', 'Raúl Lizoain', 'Diego Pampín', 'Kader Bamba', 'Sergio López', 'Chinaza Okonyia', 'Baïla Diallo', 'Benedikt Gimber', 'Mario Gambín', 'Juanjo Flores', 'Dylan Rodríguez', 'Angelo García', 'Bourama Dembelé', 'Owen Emeka', 'Íker García'],
    'Las Palmas': ['Marvin Park', 'N. Opoku', 'Álex Suárez', 'Enrique Clemente', 'Iñaki González', 'Jefté Betancor', 'Sergio Ruiz', 'Jeremía Recoba', 'Jesé Rodríguez', 'Taisei Miyashiro', 'Enzo Loiodice', 'José Antonio Caro', 'Manu Fuster', 'Juanma Herzog', 'Mateo Aćimović', 'Viti Rozada', 'Edward Cedeño', 'Sandro Ramírez', 'Kirian Rodríguez', 'Giovanni Bonfanti', 'Ale García', 'Andrés Rodríguez', 'Iván Jaime', 'Valentín Pezzolesi', 'Aboubacar Bassinga', 'Elías Romero', 'Iván Medina', 'Adam Arvelo', 'Rafa Cruz', 'Jorge Cruz', 'Adri Suárez', 'A. Domínguez'],
    'Leganés': ['Raúl Fernández', 'Marvel', 'Javi Montero', 'Rubén Pulido', 'Ignasi Miquel', 'Lalo Aguilar', 'Rubén Peña', 'Y. Kechta', 'Álex Millán', 'Zico Buurmeester', 'Naim García', 'Luca Zidane', 'Dani Rodríguez', 'Enric Franquesa', 'Unax del Cura', 'Ismaël Gharbi', 'Andrés Campos', 'Patrick Soko', 'Miguel Atienza', 'Á. Morata', 'Álex Sancris', 'Álvaro Tejero', 'Amadou Diawara', 'Álex Fita', 'Nicolás Lozano', 'Sule', 'Jorge Herrero', 'S. Mulumba', 'Ale Gorrín'],
    'Mallorca': ['Arnau Tenas', 'Guille Fernández', 'Toni Lato', 'David López', 'Alberto Moreno', 'Antonio Sánchez', 'Álex Sala', 'Manu Morlanes', 'Abdón Prats', 'Sergi Darder', 'Zito Luvumbo', 'Lucas Bergström', 'Daniel Luna', 'John Chetauya', 'Adam Buksa', 'Arnau Puigmal', 'Adrián Fuentes', 'Josep Cerdà', 'Pablo Torre', 'Antonio Raíllo', 'Aboubaka Soumahoro', 'Antoniu Roca', 'Martin Valjent', 'Iván Cuéllar', 'Luis Orejuela', 'Justin Kalumba', 'Adrián Liso', 'Miguel Calatayud', 'Toni Dols'],
    'Real Oviedo': ['Miguel Narváez', 'Aisar Ahmed', 'Juan Cruz', 'David Costas', 'Youness Lachhab', 'Dani Villahermosa', 'Ilyas Chaira', 'Mikel Goti', 'Chris Ramos', 'Alberto Reina', 'Jacobo González', 'Dani Calvo', 'Aarón Escandell', 'Carlos Fernández', 'Samu Rodríguez', 'Aritz Aldasoro', 'Estanis Pedrola', 'Víctor Mingo', 'Pablo Sáenz', 'David Jiménez', 'Nacho Vidal', 'Carlos Domínguez', 'Alexandru Ișfan', 'José Luis Morales', 'Samu Franganillo', 'Dieguito Menéndez', 'Marco Esteban', 'Enzo Pérez', 'Óscar de la Hera', 'Brandon Domingues'],
    'Real Sociedad B': ['Aitor Fraga', 'Jon Garro', 'Jon Balda', 'Luken Beitia', 'Kazunari Kita', 'Alex Lebarbier', 'Dani Díaz', 'Ibai Aguirre', 'Ekain Orobengoa', 'Arkaitz Mariezkurrena', 'Alex Marchal', 'Joan Oleaga', 'Theo Folgado', 'Tomy Carbonell', 'Iker Calderón', 'Gorka Gorosabel', 'Lander Astiazarán', 'Gorka Carrera', 'Javier Soroeta', 'Sydney Osazuwa', 'Jon Eceizabarrena', 'Iñaki Rupérez', 'Unax Agote', 'Unax Ayo', 'Beñat Isasa', 'Iker Ropero', 'Peru Larrañaga', 'Oihan Telletxea', 'Lander Olasagasti', 'Eloy Nebreda', 'Andrews Adjabeng'],
    'Real Valladolid': ['Álvaro Aceves', 'Trilli', 'Homam Elamin', 'David Torres', 'Ramón Martínez', 'Mathis Lachuer', 'Luis Chacón', 'Thiago Ojeda', 'Juanmi Latasa', 'Yeray Cabanzón', 'Miguel Rubio', 'Dani Martín', 'Iván Alejo', 'Pablo Tomeo', 'Álex Balboa', 'Víctor Barberà', 'Carlos Clerc', 'Adrián Arnuncio', 'Robin van Duiven', 'Julien Ponceau', 'Kaj de Rooij', 'Tay Abed', 'Stanko Jurić', 'Lucas Lavagnino', 'Iván Garriel', 'Dani Pérez', 'Víctor Fernández', 'Marcos Parriego', 'Brain Chinedu', 'Alejandro Galdeano', 'Hugo Calvo', 'Ryotaro Ito'],
    'Sabadell': ['Diego Fuoli', 'Pipa', 'Genar Fornés', 'Miki Codina', 'Arthur Bonaldo', 'Edgar González', 'Ton Ripoll', 'Pere Pons', 'Ángel Baena', 'Javi López-Pinto', 'Gastón Valles', 'José Ortega', 'Óscar Sanz', 'Kaiser', 'Nicholas Gioacchini', 'Nikolay Obolskiy', 'Yanis Rahmani', 'Urri', 'Alain Ribeiro', 'Quadri Liameed', 'Joel Priego', 'Eneko Aguilar', 'Marc Vidal', 'José Luis Catalá', 'Patrick Nuamah', 'Xavi Moreno', 'Manel Estévez', 'Yussif Owusu'],
    'Sporting de Gijón': ['Rubén Yáñez', 'Guille Rosas', 'Pablo García', 'Emanuel Gularte', 'Diego Sánchez', 'Nacho Martín', 'Gaspar Campos', 'Manu Rodríguez', 'Andrés Ferrari', 'César Gelabert', 'Konrad de la Fuente', 'Egoitz Arana', 'Álex Corredera', 'Pablo Vázquez', 'Alejo Sarco', 'Antonio Casas', 'Juan Otero', 'Nikita Iosifov', 'Mamadou Loum', 'Hugo Guillamón', 'Jorge Sáenz', 'Aimar Duñabeitia', 'Iker Martínez', 'Enol Prendes', 'Andrés Cuenca'],
    'Tenerife': ['Dani Martín', 'David Rodríguez', 'Roko Jureškin', 'José León', 'Jorge Moreno', 'Juanjo', 'Martin Pečar', 'Víctor Moreno', 'Jesús de Miguel', 'Nacho Gil', 'Noel López', 'Anthony Landázuri', 'Gerard Valentín', 'Fabricio', 'Jesús Álvarez', 'Christian Gomis', 'Enric Gallego', 'César Álvarez', 'Mauro Pittón', 'Marc Mateu', 'Grant-Leon Ranos', 'Anes Krdžalić', 'Iván Chapela', 'Baba Diocou', 'Neal Viereck', 'Dani Fernández', 'Gabriel Lozano', 'Alassan']
  },

  /* Nombre del archivo Excel que genera la app. */
  NOMBRE_EXCEL: 'goles-encajados-celta-fortuna.xlsx',

  /* Guardar el vídeo dentro del navegador (true) o solo su nombre/enlace (false).
     true = puedes volver a ver el clip desde la app, pero ocupa espacio en el
     dispositivo. false = la app no almacena vídeo, solo los datos. */
  GUARDAR_VIDEO: true,

  /* Aviso cuando el vídeo guardado supere este tamaño, en megas. */
  AVISO_VIDEO_MB: 80,

  /* Por encima de este tamaño (megas) el vídeo se reproduce pero no se
     guarda en la app: evita meter un partido entero en el navegador. */
  MAX_VIDEO_MB: 600
};
