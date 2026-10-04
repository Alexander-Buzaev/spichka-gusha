// Небо для «Кофейной гущи»: двадцать созвездий северного неба, распределённых по всем сторонам и сезонам, и минимальная астрономия,
// которой хватает, чтобы навести сцену по компасу и гироскопу.
//
// Координаты звёзд — J2000 (эпоха 2000.0), ra в десятичных часах, dec в градусах, mag — видимая
// звёздная величина. Прецессию не учитываем: за четверть века она уводит звезду примерно на 0.35°,
// что заметно меньше собственной погрешности компаса телефона (единицы градусов).
//
// Система координат горизонта: alt — высота над горизонтом, az — азимут от севера по часовой
// стрелке (север 0, восток π/2, юг π, запад 3π/2). Это ровно та же система, в которой живёт
// heading из sensors.js, поэтому наведение сводится к сравнению двух углов.

const HOUR = Math.PI / 12;        // час прямого восхождения в радианах
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

export const CONSTELLATIONS = [
  {
    id: 'ursa-major',
    name: 'Большая Медведица',
    stars: [
      { id: 'dubhe',  name: 'Дубхе',   ra: 11.0621, dec: 61.7511, mag: 1.79 },
      { id: 'merak',  name: 'Мерак',   ra: 11.0307, dec: 56.3825, mag: 2.37 },
      { id: 'phecda', name: 'Фекда',   ra: 11.8972, dec: 53.6948, mag: 2.44 },
      { id: 'megrez', name: 'Мегрец',  ra: 12.2571, dec: 57.0326, mag: 3.31 },
      { id: 'alioth', name: 'Алиот',   ra: 12.9005, dec: 55.9598, mag: 1.77 },
      { id: 'mizar',  name: 'Мицар',   ra: 13.3987, dec: 54.9254, mag: 2.23 },
      { id: 'alkaid', name: 'Бенетнаш', ra: 13.7923, dec: 49.3133, mag: 1.86 }
    ],
    lines: [
      ['dubhe', 'merak'], ['merak', 'phecda'], ['phecda', 'megrez'], ['megrez', 'dubhe'],
      ['megrez', 'alioth'], ['alioth', 'mizar'], ['mizar', 'alkaid']
    ]
  },
  {
    id: 'cassiopeia',
    name: 'Кассиопея',
    stars: [
      { id: 'caph',    name: 'Каф',    ra: 0.1530, dec: 59.1497, mag: 2.28 },
      { id: 'schedar', name: 'Шедар',  ra: 0.6751, dec: 56.5373, mag: 2.24 },
      { id: 'navi',    name: 'Нави',   ra: 0.9451, dec: 60.7167, mag: 2.47 },
      { id: 'ruchbah', name: 'Рукба',  ra: 1.4303, dec: 60.2353, mag: 2.68 },
      { id: 'segin',   name: 'Сегин',  ra: 1.9066, dec: 63.6700, mag: 3.37 }
    ],
    lines: [
      ['caph', 'schedar'], ['schedar', 'navi'], ['navi', 'ruchbah'], ['ruchbah', 'segin']
    ]
  },
  {
    id: 'orion',
    name: 'Орион',
    stars: [
      { id: 'betelgeuse', name: 'Бетельгейзе', ra: 5.9195, dec:  7.4071, mag: 0.45 },
      { id: 'rigel',      name: 'Ригель',      ra: 5.2423, dec: -8.2017, mag: 0.18 },
      { id: 'bellatrix',  name: 'Беллатрикс',  ra: 5.4185, dec:  6.3497, mag: 1.64 },
      { id: 'mintaka',    name: 'Минтака',     ra: 5.5335, dec: -0.2991, mag: 2.23 },
      { id: 'alnilam',    name: 'Альнилам',    ra: 5.6036, dec: -1.2019, mag: 1.69 },
      { id: 'alnitak',    name: 'Альнитак',    ra: 5.6793, dec: -1.9426, mag: 1.77 },
      { id: 'saiph',      name: 'Саиф',        ra: 5.7960, dec: -9.6697, mag: 2.07 },
      { id: 'meissa',     name: 'Мейсса',      ra: 5.5856, dec:  9.9342, mag: 3.39 },
      { id: 'hatsya',     name: 'Хатиса',      ra: 5.5906, dec: -5.9100, mag: 2.75 }
    ],
    lines: [
      ['betelgeuse', 'bellatrix'],
      ['bellatrix', 'mintaka'], ['mintaka', 'alnilam'], ['alnilam', 'alnitak'],
      ['alnitak', 'betelgeuse'],
      ['mintaka', 'rigel'], ['alnitak', 'saiph'], ['rigel', 'saiph'],
      ['meissa', 'betelgeuse'], ['meissa', 'bellatrix'],
      ['alnilam', 'hatsya']
    ]
  },
  {
    id: 'cygnus',
    name: 'Лебедь',
    stars: [
      { id: 'deneb',       name: 'Денеб',    ra: 20.6905, dec: 45.2803, mag: 1.25 },
      { id: 'sadr',        name: 'Садр',     ra: 20.3705, dec: 40.2567, mag: 2.23 },
      { id: 'albireo',     name: 'Альбирео', ra: 19.5120, dec: 27.9597, mag: 3.08 },
      { id: 'delta-cyg',   name: 'Фаварис',  ra: 19.7496, dec: 45.1308, mag: 2.87 },
      { id: 'epsilon-cyg', name: 'Дженах',   ra: 20.7702, dec: 33.9703, mag: 2.48 }
    ],
    lines: [
      ['deneb', 'sadr'], ['sadr', 'albireo'],
      ['delta-cyg', 'sadr'], ['sadr', 'epsilon-cyg']
    ]
  },
  {
    id: 'lyra',
    name: 'Лира',
    stars: [
      { id: 'vega',       name: 'Вега',    ra: 18.6156, dec: 38.7837, mag: 0.03 },
      { id: 'epsilon-lyr', name: 'ε Лиры', ra: 18.7390, dec: 39.6700, mag: 4.59 },
      { id: 'zeta-lyr',   name: 'ζ Лиры',  ra: 18.7462, dec: 37.6050, mag: 4.36 },
      { id: 'sheliak',    name: 'Шелиак',  ra: 18.8347, dec: 33.3628, mag: 3.52 },
      { id: 'sulafat',    name: 'Сулафат', ra: 18.9824, dec: 32.6894, mag: 3.24 },
      { id: 'delta2-lyr', name: 'δ² Лиры', ra: 18.9084, dec: 36.8986, mag: 4.30 }
    ],
    lines: [
      ['vega', 'epsilon-lyr'], ['vega', 'zeta-lyr'], ['epsilon-lyr', 'zeta-lyr'],
      ['zeta-lyr', 'sheliak'], ['sheliak', 'sulafat'],
      ['sulafat', 'delta2-lyr'], ['delta2-lyr', 'zeta-lyr']
    ]
  },
  {
    id: 'aquila',
    name: 'Орёл',
    stars: [
      { id: 'altair',   name: 'Альтаир', ra: 19.8464, dec:  8.8683, mag: 0.76 },
      { id: 'tarazed',  name: 'Таразед', ra: 19.7710, dec: 10.6133, mag: 2.72 },
      { id: 'alshain',  name: 'Альшаин', ra: 19.9219, dec:  6.4067, mag: 3.71 },
      { id: 'delta-aql', name: 'δ Орла', ra: 19.4250, dec:  3.1147, mag: 3.36 },
      { id: 'zeta-aql', name: 'Окаб',    ra: 19.0902, dec: 13.8633, mag: 2.99 },
      { id: 'theta-aql', name: 'θ Орла', ra: 20.1884, dec: -0.8214, mag: 3.23 },
      { id: 'lambda-aql', name: 'Альтхалимайн', ra: 19.1041, dec: -4.8825, mag: 3.43 },
      { id: 'eta-aql',  name: 'η Орла',  ra: 19.8746, dec:  1.0056, mag: 3.90 }
    ],
    lines: [
      ['zeta-aql', 'tarazed'], ['tarazed', 'altair'], ['altair', 'alshain'],
      ['altair', 'delta-aql'], ['delta-aql', 'lambda-aql'],
      ['altair', 'eta-aql'], ['eta-aql', 'theta-aql']
    ]
  },
  {
    id: 'leo',
    name: 'Лев',
    stars: [
      { id: 'regulus',  name: 'Регул',     ra: 10.1395, dec: 11.9672, mag: 1.36 },
      { id: 'denebola', name: 'Денебола',  ra: 11.8177, dec: 14.5719, mag: 2.14 },
      { id: 'algieba',  name: 'Альгиеба',  ra: 10.3329, dec: 19.8417, mag: 2.08 },
      { id: 'zosma',    name: 'Зосма',     ra: 11.2351, dec: 20.5236, mag: 2.56 },
      { id: 'chertan',  name: 'Чертан',    ra: 11.2373, dec: 15.4297, mag: 3.33 },
      { id: 'adhafera', name: 'Адхафера',  ra: 10.2781, dec: 23.4172, mag: 3.44 },
      { id: 'eta-leo',  name: 'η Льва',    ra: 10.1222, dec: 16.7628, mag: 3.48 },
      { id: 'rasalas',  name: 'Расалас',   ra:  9.8794, dec: 26.0069, mag: 3.88 },
      { id: 'algenubi', name: 'Альгенуби', ra:  9.7642, dec: 23.7742, mag: 2.98 }
    ],
    lines: [
      ['algenubi', 'rasalas'], ['rasalas', 'adhafera'], ['adhafera', 'algieba'],
      ['algieba', 'eta-leo'], ['eta-leo', 'regulus'],
      ['regulus', 'chertan'], ['chertan', 'denebola'], ['denebola', 'zosma'],
      ['zosma', 'chertan'], ['algieba', 'zosma']
    ]
  },
  {
    id: 'ursa-minor', name: 'Малая Медведица',
    stars: [
      { id: 'polaris', name: 'Полярная', ra: 2.5303, dec: 89.2641, mag: 1.98 },
      { id: 'yildun', ra: 17.5367, dec: 86.5864, mag: 4.36 },
      { id: 'eps-umi', ra: 16.7661, dec: 82.0372, mag: 4.23 },
      { id: 'zet-umi', ra: 15.7343, dec: 77.7945, mag: 4.32 },
      { id: 'kochab', name: 'Кохаб', ra: 14.8451, dec: 74.1555, mag: 2.08 },
      { id: 'pherkad', name: 'Феркад', ra: 15.3455, dec: 71.8340, mag: 3.05 },
      { id: 'eta-umi', ra: 16.2918, dec: 75.7553, mag: 4.95 }
    ],
    lines: [['polaris','yildun'],['yildun','eps-umi'],['eps-umi','zet-umi'],['zet-umi','kochab'],['kochab','pherkad'],['pherkad','eta-umi'],['eta-umi','zet-umi']]
  },
  {
    id: 'scorpius', name: 'Скорпион',
    stars: [
      { id: 'antares', name: 'Антарес', ra: 16.4901, dec: -26.4320, mag: 1.06 },
      { id: 'dschubba', name: 'Дшубба', ra: 16.0056, dec: -22.6217, mag: 2.29 },
      { id: 'acrab', ra: 16.0906, dec: -19.8054, mag: 2.62 },
      { id: 'pi-sco', ra: 15.9809, dec: -26.1141, mag: 2.89 },
      { id: 'tau-sco', ra: 16.5980, dec: -28.2160, mag: 2.82 },
      { id: 'eps-sco', ra: 16.8361, dec: -34.2932, mag: 2.29 },
      { id: 'mu-sco', ra: 16.8645, dec: -38.0474, mag: 3.04 },
      { id: 'zet-sco', ra: 16.9097, dec: -42.3614, mag: 3.62 },
      { id: 'eta-sco', ra: 17.2026, dec: -43.2392, mag: 3.32 },
      { id: 'sargas', name: 'Саргас', ra: 17.6220, dec: -42.9978, mag: 1.86 },
      { id: 'kap-sco', ra: 17.7081, dec: -39.0300, mag: 2.39 },
      { id: 'shaula', name: 'Шаула', ra: 17.5601, dec: -37.1038, mag: 1.62 },
      { id: 'lesath', name: 'Лесат', ra: 17.5127, dec: -37.2958, mag: 2.70 }
    ],
    lines: [['acrab','dschubba'],['dschubba','pi-sco'],['dschubba','antares'],['antares','tau-sco'],['tau-sco','eps-sco'],['eps-sco','mu-sco'],['mu-sco','zet-sco'],['zet-sco','eta-sco'],['eta-sco','sargas'],['sargas','kap-sco'],['kap-sco','shaula'],['shaula','lesath']]
  },
  {
    id: 'sagittarius', name: 'Стрелец',
    stars: [
      { id: 'kaus-aus', name: 'Каус Аустралис', ra: 18.4029, dec: -34.3846, mag: 1.79 },
      { id: 'kaus-med', ra: 18.3499, dec: -29.8281, mag: 2.72 },
      { id: 'kaus-bor', ra: 18.4662, dec: -25.4217, mag: 2.82 },
      { id: 'nunki', name: 'Нунки', ra: 18.9211, dec: -26.2967, mag: 2.05 },
      { id: 'ascella', ra: 19.0435, dec: -29.8801, mag: 2.60 },
      { id: 'phi-sgr', ra: 18.7609, dec: -26.9908, mag: 3.17 },
      { id: 'tau-sgr', ra: 19.1157, dec: -27.6704, mag: 3.32 },
      { id: 'alnasl', name: 'Альнасль', ra: 18.0968, dec: -30.4241, mag: 2.98 }
    ],
    lines: [['alnasl','kaus-med'],['kaus-med','kaus-aus'],['kaus-med','kaus-bor'],['kaus-bor','phi-sgr'],['phi-sgr','nunki'],['nunki','tau-sgr'],['tau-sgr','ascella'],['ascella','phi-sgr'],['ascella','kaus-aus']]
  },
  {
    id: 'pegasus', name: 'Пегас',
    stars: [
      { id: 'markab', name: 'Маркаб', ra: 23.0793, dec: 15.2053, mag: 2.49 },
      { id: 'scheat', name: 'Шеат', ra: 23.0629, dec: 28.0828, mag: 2.44 },
      { id: 'algenib', name: 'Альгениб', ra: 0.2206, dec: 15.1836, mag: 2.83 },
      { id: 'alpheratz', name: 'Альферац', ra: 0.1398, dec: 29.0904, mag: 2.07 },
      { id: 'enif', name: 'Эниф', ra: 21.7364, dec: 9.8750, mag: 2.38 },
      { id: 'matar', ra: 22.7167, dec: 30.2212, mag: 2.93 },
      { id: 'homam', ra: 22.6911, dec: 10.8314, mag: 3.41 },
      { id: 'baham', ra: 22.1699, dec: 6.1979, mag: 3.52 }
    ],
    lines: [['markab','scheat'],['scheat','alpheratz'],['alpheratz','algenib'],['algenib','markab'],['markab','homam'],['homam','baham'],['baham','enif'],['scheat','matar']]
  },
  {
    id: 'andromeda', name: 'Андромеда',
    stars: [
      { id: 'alpheratz-and', name: 'Альферац', ra: 0.1398, dec: 29.0904, mag: 2.07 },
      { id: 'del-and', ra: 0.6555, dec: 30.8611, mag: 3.27 },
      { id: 'mirach', name: 'Мирах', ra: 1.1622, dec: 35.6206, mag: 2.07 },
      { id: 'almach', name: 'Аламак', ra: 2.0650, dec: 42.3297, mag: 2.10 },
      { id: 'mu-and', ra: 0.9459, dec: 38.4993, mag: 3.86 },
      { id: 'nu-and', ra: 0.8302, dec: 41.0789, mag: 4.53 }
    ],
    lines: [['alpheratz-and','del-and'],['del-and','mirach'],['mirach','almach'],['mirach','mu-and'],['mu-and','nu-and']]
  },
  {
    id: 'perseus', name: 'Персей',
    stars: [
      { id: 'mirfak', name: 'Мирфак', ra: 3.4054, dec: 49.8612, mag: 1.79 },
      { id: 'algol', name: 'Алголь', ra: 3.1361, dec: 40.9556, mag: 2.09 },
      { id: 'gam-per', ra: 3.0800, dec: 53.5065, mag: 2.91 },
      { id: 'del-per', ra: 3.7152, dec: 47.7875, mag: 3.01 },
      { id: 'eps-per', ra: 3.9642, dec: 40.0103, mag: 2.90 },
      { id: 'zet-per', ra: 3.9022, dec: 31.8836, mag: 2.84 },
      { id: 'eta-per', ra: 2.8449, dec: 55.8955, mag: 3.77 },
      { id: 'rho-per', ra: 3.0864, dec: 38.8404, mag: 3.39 }
    ],
    lines: [['eta-per','gam-per'],['gam-per','mirfak'],['mirfak','del-per'],['del-per','eps-per'],['eps-per','zet-per'],['mirfak','algol'],['algol','rho-per']]
  },
  {
    id: 'taurus', name: 'Телец',
    stars: [
      { id: 'aldebaran', name: 'Альдебаран', ra: 4.5987, dec: 16.5093, mag: 0.87 },
      { id: 'elnath', name: 'Эльнат', ra: 5.4382, dec: 28.6075, mag: 1.65 },
      { id: 'zet-tau', ra: 5.6275, dec: 21.1425, mag: 2.97 },
      { id: 'the-tau', ra: 4.4769, dec: 15.8709, mag: 3.40 },
      { id: 'gam-tau', ra: 4.3297, dec: 15.6276, mag: 3.65 },
      { id: 'del-tau', ra: 4.3829, dec: 17.5425, mag: 3.77 },
      { id: 'eps-tau', ra: 4.4777, dec: 19.1804, mag: 3.53 },
      { id: 'lam-tau', ra: 4.0113, dec: 12.4903, mag: 3.41 },
      { id: 'alcyone', name: 'Альциона', ra: 3.7914, dec: 24.1051, mag: 2.85 }
    ],
    lines: [['aldebaran','the-tau'],['the-tau','gam-tau'],['gam-tau','del-tau'],['del-tau','eps-tau'],['eps-tau','elnath'],['aldebaran','zet-tau'],['gam-tau','lam-tau'],['eps-tau','alcyone']]
  },
  {
    id: 'gemini', name: 'Близнецы',
    stars: [
      { id: 'castor', name: 'Кастор', ra: 7.5766, dec: 31.8883, mag: 1.58 },
      { id: 'pollux', name: 'Поллукс', ra: 7.7553, dec: 28.0262, mag: 1.14 },
      { id: 'alhena', name: 'Альхена', ra: 6.6285, dec: 16.3993, mag: 1.93 },
      { id: 'tejat', ra: 6.3827, dec: 22.5136, mag: 2.87 },
      { id: 'mebsuta', ra: 6.7322, dec: 25.1311, mag: 3.06 },
      { id: 'wasat', ra: 7.3354, dec: 21.9821, mag: 3.53 },
      { id: 'kap-gem', ra: 7.7405, dec: 24.3980, mag: 3.57 },
      { id: 'tau-gem', ra: 7.1857, dec: 30.2452, mag: 4.41 },
      { id: 'propus', ra: 6.2480, dec: 22.5068, mag: 3.28 }
    ],
    lines: [['castor','tau-gem'],['tau-gem','mebsuta'],['mebsuta','tejat'],['tejat','propus'],['pollux','kap-gem'],['kap-gem','wasat'],['wasat','alhena'],['castor','pollux']]
  },
  {
    id: 'auriga', name: 'Возничий',
    stars: [
      { id: 'capella', name: 'Капелла', ra: 5.2782, dec: 45.9980, mag: 0.08 },
      { id: 'menkalinan', name: 'Менкалинан', ra: 5.9921, dec: 44.9474, mag: 1.90 },
      { id: 'the-aur', ra: 5.9954, dec: 37.2125, mag: 2.65 },
      { id: 'elnath-aur', name: 'Эльнат', ra: 5.4382, dec: 28.6075, mag: 1.65 },
      { id: 'hassaleh', ra: 4.9499, dec: 33.1661, mag: 2.69 },
      { id: 'almaaz', ra: 5.0328, dec: 43.8233, mag: 3.03 }
    ],
    lines: [['capella','menkalinan'],['menkalinan','the-aur'],['the-aur','elnath-aur'],['elnath-aur','hassaleh'],['hassaleh','almaaz'],['almaaz','capella']]
  },
  {
    id: 'canis-major', name: 'Большой Пёс',
    stars: [
      { id: 'sirius', name: 'Сириус', ra: 6.7525, dec: -16.7161, mag: -1.46 },
      { id: 'mirzam', name: 'Мирцам', ra: 6.3783, dec: -17.9559, mag: 1.98 },
      { id: 'adhara', name: 'Адара', ra: 6.9771, dec: -28.9721, mag: 1.50 },
      { id: 'wezen', name: 'Везен', ra: 7.1399, dec: -26.3932, mag: 1.83 },
      { id: 'aludra', name: 'Алудра', ra: 7.4016, dec: -29.3031, mag: 2.45 },
      { id: 'muliphein', ra: 7.0627, dec: -15.6331, mag: 4.11 },
      { id: 'omi2-cma', ra: 7.0501, dec: -23.8333, mag: 3.02 }
    ],
    lines: [['sirius','mirzam'],['sirius','muliphein'],['sirius','omi2-cma'],['omi2-cma','wezen'],['wezen','adhara'],['wezen','aludra']]
  },
  {
    id: 'bootes', name: 'Волопас',
    stars: [
      { id: 'arcturus', name: 'Арктур', ra: 14.2610, dec: 19.1824, mag: -0.05 },
      { id: 'izar', name: 'Ицар', ra: 14.7498, dec: 27.0742, mag: 2.37 },
      { id: 'muphrid', name: 'Муфрид', ra: 13.9115, dec: 18.3977, mag: 2.68 },
      { id: 'seginus', ra: 14.5346, dec: 38.3083, mag: 3.03 },
      { id: 'nekkar', ra: 15.0324, dec: 40.3906, mag: 3.49 },
      { id: 'del-boo', ra: 15.2583, dec: 33.3148, mag: 3.47 },
      { id: 'rho-boo', ra: 14.5305, dec: 30.3711, mag: 3.58 }
    ],
    lines: [['arcturus','muphrid'],['arcturus','izar'],['izar','del-boo'],['del-boo','nekkar'],['nekkar','seginus'],['seginus','rho-boo'],['rho-boo','arcturus']]
  },
  {
    id: 'virgo', name: 'Дева',
    stars: [
      { id: 'spica', name: 'Спика', ra: 13.4199, dec: -11.1613, mag: 0.97 },
      { id: 'porrima', name: 'Поррима', ra: 12.6943, dec: -1.4494, mag: 2.74 },
      { id: 'vindemiatrix', name: 'Виндемиатрикс', ra: 13.0363, dec: 10.9592, mag: 2.83 },
      { id: 'auva', ra: 12.9265, dec: 3.3975, mag: 3.38 },
      { id: 'heze', ra: 13.5783, dec: -0.5958, mag: 3.37 },
      { id: 'zaniah', ra: 12.3316, dec: -0.6669, mag: 3.89 },
      { id: 'zavijava', ra: 11.8447, dec: 1.7647, mag: 3.60 }
    ],
    lines: [['spica','porrima'],['porrima','zaniah'],['zaniah','zavijava'],['porrima','auva'],['auva','vindemiatrix'],['spica','heze'],['heze','auva']]
  },
  {
    id: 'corona-borealis', name: 'Северная Корона',
    stars: [
      { id: 'alphecca', name: 'Альфекка', ra: 15.5781, dec: 26.7147, mag: 2.23 },
      { id: 'nusakan', ra: 15.4638, dec: 29.1058, mag: 3.68 },
      { id: 'the-crb', ra: 15.5488, dec: 31.3592, mag: 4.14 },
      { id: 'gam-crb', ra: 15.7124, dec: 26.2957, mag: 3.84 },
      { id: 'del-crb', ra: 15.8264, dec: 26.0681, mag: 4.63 },
      { id: 'eps-crb', ra: 15.9598, dec: 26.8779, mag: 4.15 },
      { id: 'iot-crb', ra: 16.0245, dec: 29.8511, mag: 4.99 }
    ],
    lines: [['the-crb','nusakan'],['nusakan','alphecca'],['alphecca','gam-crb'],['gam-crb','del-crb'],['del-crb','eps-crb'],['eps-crb','iot-crb']]
  }
];


// Полярная — отдельно: она не рисунок, а ось. Её высота над горизонтом равна широте наблюдателя,
// вокруг неё поворачивается всё остальное небо. Удобная точка калибровки компаса.
export const POLARIS = { id: 'polaris', name: 'Полярная', ra: 2.5303, dec: 89.2641, mag: 1.98 };

// Юлианская дата из JS-Date (UTC). 2440587.5 — JD эпохи Unix.
export function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// Гринвичское среднее звёздное время в радианах (IAU 1982, точности с запасом).
export function gmst(date) {
  const d = julianDate(date) - 2451545.0;
  const t = d / 36525;
  let deg = 280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - t * t * t / 38710000;
  deg = deg % 360; if (deg < 0) deg += 360;
  return deg * DEG;
}

// Местное звёздное время в радианах. lon — восточная долгота в градусах.
export function lst(lon, date) {
  const v = (gmst(date) + lon * DEG) % TAU;
  return v < 0 ? v + TAU : v;
}

// Экватор → горизонт. ra в часах, dec/lat/lon в градусах, date — Date (UTC внутри).
// Возвращает { alt, az } в радианах; az отсчитывается от севера по часовой стрелке.
export function altAz(ra, dec, lat, lon, date) {
  const phi = lat * DEG, delta = dec * DEG;
  const h = lst(lon, date) - ra * HOUR;           // часовой угол
  const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
  const sinDec = Math.sin(delta), cosDec = Math.cos(delta);
  const cosH = Math.cos(h), sinH = Math.sin(h);
  const sinAlt = sinDec * sinPhi + cosDec * cosPhi * cosH;
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  let az = Math.atan2(-cosDec * sinH, sinDec * cosPhi - cosDec * sinPhi * cosH);
  if (az < 0) az += TAU;
  return { alt, az };
}

// Горизонт → единичный вектор сцены: x — восток, y — вверх, z — север.
export function skyToDir(alt, az) {
  const c = Math.cos(alt);
  return { x: c * Math.sin(az), y: Math.sin(alt), z: c * Math.cos(az) };
}

// Удобная свёртка: все звёзды созвездия в горизонтальных координатах и в векторах,
// плюс высота его центра (по среднему вектору) — по ней выбирают, что показывать.
export function placeConstellation(constellation, lat, lon, date) {
  let sx = 0, sy = 0, sz = 0;
  const stars = constellation.stars.map(s => {
    const { alt, az } = altAz(s.ra, s.dec, lat, lon, date);
    const dir = skyToDir(alt, az);
    sx += dir.x; sy += dir.y; sz += dir.z;
    return { ...s, alt, az, dir };
  });
  const len = Math.hypot(sx, sy, sz) || 1;
  const center = { x: sx / len, y: sy / len, z: sz / len };
  return {
    id: constellation.id,
    name: constellation.name,
    stars,
    lines: constellation.lines,
    center,
    centerAlt: Math.asin(Math.max(-1, Math.min(1, center.y))),
    centerAz: (Math.atan2(center.x, center.z) + TAU) % TAU
  };
}
