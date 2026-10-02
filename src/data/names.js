// Nombres y apellidos frecuentes por país para generar juveniles y completar planteles.
DT.NAMES = {
  ARG: {
    f: 'Santiago Mateo Thiago Benjamín Valentín Lautaro Joaquín Tomás Facundo Agustín Franco Nicolás Ignacio Bautista Matías Gonzalo Lucas Julián Ezequiel Maximiliano Federico Emiliano Juan Cruz Leandro Nahuel Gastón Ramiro Kevin Brian Alan Lisandro Enzo Bruno Martín Rodrigo Tobías Felipe Gianluca Mauro Iván Germán Elías'.split(' '),
    l: 'González Rodríguez Gómez Fernández López Díaz Martínez Pérez Romero Sosa Álvarez Torres Ruiz Ramírez Flores Benítez Acosta Medina Herrera Suárez Aguirre Giménez Gutiérrez Pereyra Molina Castro Ortiz Silva Núñez Rojas Luna Juárez Cabrera Ríos Ferreyra Godoy Morales Domínguez Moreno Peralta Vega Carrizo Quiroga Castillo Ledesma Muñoz Ojeda Ponce Vera Villalba Coronel Barrios Paz Correa Toledo Figueroa Arias Campos Bustos Vázquez Lucero Bianchi Rossi Romano Colombo Ferrari Ricci Bruno Galli Mansilla Insaurralde Zárate'.split(' '),
  },
  BRA: {
    f: 'Gabriel Lucas Matheus Pedro Guilherme Gustavo Rafael Felipe Bruno João Vitor Leonardo Thiago Caio Arthur Davi Eduardo Henrique Rodrigo Igor Luiz Diego Daniel Murilo Kauã Enzo Breno Wesley Renan Marcos Vinícius Samuel Ryan Kaique Cauã Yuri Douglas Wellington Everton'.split(' '),
    l: 'Silva Santos Oliveira Souza Rodrigues Ferreira Alves Pereira Lima Gomes Costa Ribeiro Martins Carvalho Almeida Lopes Soares Fernandes Vieira Barbosa Rocha Dias Nascimento Andrade Moreira Nunes Marques Machado Mendes Freitas Cardoso Ramos Gonçalves Santana Teixeira Araújo Pinto Correia Batista Moura Cavalcanti Monteiro Campos'.split(' '),
    mono: 'Juninho Netinho Paulinho Rafinha Dudu Marquinhos Zé Ricardo Gabrielzinho Luizinho Pedrinho Cauãzinho Kaká Tetê Dedé Fabinho Bruninho Matheusinho Vitinho Robinho Romarinho Ronaldinho Léo Lipe Nenê Tiaguinho Gui Biel Kayky Pablo'.split(' '),
  },
  URU: {
    f: 'Agustín Facundo Nicolás Santiago Matías Gonzalo Federico Diego Sebastián Rodrigo Martín Joaquín Franco Bruno Maximiliano Mathías Emiliano Lucas Brian Kevin Juan Felipe Ignacio Guillermo Leandro Álvaro Gastón'.split(' '),
    l: 'Rodríguez González Fernández Silva Pérez Martínez López Sosa Díaz Suárez Pereira Núñez Rodríguez Olivera Cabrera Acosta Ramírez Techera Cardozo Méndez Romero Castro De los Santos Correa Viera Píriz Báez Bentancur Arrascaeta Laxalt Olivera Pintos Coates'.split(' '),
  },
  CHI: {
    f: 'Benjamín Vicente Martín Matías Agustín Joaquín Tomás Cristóbal Diego Felipe Ignacio Sebastián Bastián Nicolás Maximiliano Gonzalo Francisco Javier Esteban Claudio Rodrigo Alexis Camilo Lucas Pablo'.split(' '),
    l: 'González Muñoz Rojas Díaz Pérez Soto Contreras Silva Martínez Sepúlveda Morales Rodríguez López Fuentes Hernández Torres Araya Flores Espinoza Valenzuela Castillo Tapia Reyes Gutiérrez Castro Pizarro Álvarez Vásquez Sánchez Fernández Ramírez Carrasco Gómez Cortés Herrera Núñez Jara Vergara Rivera Figueroa'.split(' '),
  },
  COL: {
    f: 'Juan Andrés Santiago Sebastián Carlos Luis Jhon Jhojan Brayan Kevin Daniel Cristian Jefferson Yerson Jorge Wilmar Duván Yeison Juan David Juan Camilo Edwin Johan Déiver Kener Andrés Felipe Fredy Jairo Sergio'.split(' '),
    l: 'Rodríguez Gómez González Martínez García López Hernández Sánchez Ramírez Pérez Díaz Torres Rojas Moreno Vargas Ortiz Jiménez Castro Mosquera Palacios Valencia Murillo Cuesta Córdoba Rentería Hinestroza Asprilla Ibarguen Quiñones Caicedo Banguero Perea Arboleda Zapata Cuadrado Mina Lerma'.split(' '),
  },
  PAR: {
    f: 'Derlis Richard Óscar Fernando Hugo Diego Juan Iván Miguel Blas Celso Gustavo Rodrigo Julio Matías Alexis Antonio Ángel Néstor Ramón Wilson Junior Robert Enzo Braian'.split(' '),
    l: 'Benítez González Martínez Giménez Ramírez Báez Cáceres Villalba Ortiz Rojas Aquino Fernández Núñez Duarte Espínola Acosta Cardozo Galeano Ayala Sanabria Riveros Insfrán Alderete Balbuena Almirón Enciso Gamarra Romero Morel Cabral Paredes'.split(' '),
  },
  PER: {
    f: 'Luis Carlos José Jorge Christian Renato Paolo Raziel Piero Gianluca Joao Yoshimar Bryan Jhilmar Alexander Edison Andy Kevin Diego Aldair Marcos Wilder Jesús Erick Franco'.split(' '),
    l: 'Quispe Flores Rodríguez García Sánchez Rojas Mendoza Huamán Chávez Vásquez Ramírez Torres Castillo Cueva Lapadula Advíncula Tapia Carrillo Peña Polo Yotún Zambrano Callens Ramos Abram Farfán Guerrero Ruidíaz Solano Gonzales Valera Concha'.split(' '),
  },
  ECU: {
    f: 'Byron Jefferson Kendry Moisés Piero Jordy Alan Ángelo Kevin Anthony John Joao Félix Cristian Carlos Jhegson Willian Ronald Pervis Gonzalo Michael Romario Enner Leonardo'.split(' '),
    l: 'Caicedo Estupiñán Hincapié Valencia Plata Sarmiento Preciado Arboleda Mena Cifuentes Méndez Torres Quiñónez Castillo Angulo Corozo Mina Cortez Minda Rodríguez Cevallos Chalá Ordóñez Pacho Porozo Yeboah Páez Alcívar'.split(' '),
  },
  BOL: {
    f: 'Marcelo Carlos Luis Diego Juan Ramiro Leonel Miguel Henry Jhasmani José Gilbert Fernando Moisés Erwin Danny Jesús Héctor Robson Adalid Boris Víctor Ervin'.split(' '),
    l: 'Mamani Quispe Vaca Villarroel Saucedo Justiniano Arce Fernández Chumacero Algarañaz Terceros Cuéllar Vargas Suárez Haquín Bejarano Lampe Moreno Abrego Paniagua Montero Chura Rocha Ribera Céspedes Torrico'.split(' '),
  },
  VEN: {
    f: 'José Luis Yeferson Salomón Darwin Jhon Eduard Telasco Jefferson Yangel Josef Ronald Tomás Christian Rómulo Wuilker Alexander Nahuel Jan Kervin Andrés Daniel Yordan Samuel'.split(' '),
    l: 'Rondón Soteldo Machís Martínez Herrera Savarino Navarro Rincón Osorio Segovia Bello Rosales Hurtado Faríñez Villanueva Cádiz Sosa Ramírez Aristeguieta Peñaranda Cásseres Urdaneta Chacón Córdova Mago Ferraresi González Moreno'.split(' '),
  },
};
