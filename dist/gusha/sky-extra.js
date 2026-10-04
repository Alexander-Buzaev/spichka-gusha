// Небо «Кофейной гущи» · добавка к /assets/sky-data.js.
//
// В наборе неба было двадцать созвездий, и пользователь сказал прямо: «слишком много зон,
// где ничего не происходит». Здесь тринадцать недостающих фигур и восемнадцать мелких
// россыпей — коротких асторизмов из трёх-пяти настоящих звёзд, которыми закрыты промежутки.
// Вместе с исходными двадцатью небо перестаёт иметь пустые сектора: при конусе магнита 24°
// в любом направлении в кадр попадает хотя бы одна фигура.
//
// Координаты — J2000, ra в десятичных часах, dec в градусах, mag — видимая величина; тот же
// формат, что в sky-data.js, поэтому placeConstellation() и altAz() из него работают и здесь.
// Прецессию не учитываем по той же причине, что и там: 0.35° за четверть века меньше
// погрешности компаса телефона.
//
// Южные фигуры (Волк) над Алматы не восходят. Они оставлены сознательно: экран работает и на
// южной широте, а фильтр по высоте над горизонтом сам их не покажет там, где их нет.

const S = (id, name, ra, dec, mag) => ({ id, name, ra, dec, mag });

export const EXTRA_CONSTELLATIONS = [
  {
    id: 'hercules', name: 'Геркулес',
    stars: [
      S('rasalgethi', 'Рас Альгети', 17.2443, 14.3903, 3.06),
      S('sarin', 'Сарин', 17.2504, 24.8392, 3.12),
      S('kornephoros', 'Корнефорос', 16.5036, 21.4896, 2.77),
      S('gamma-her', 'γ Геркулеса', 16.3696, 19.1531, 3.75),
      S('zeta-her', 'ζ Геркулеса', 16.6883, 31.6033, 2.81),
      S('epsilon-her', 'ε Геркулеса', 17.0047, 30.9264, 3.92),
      S('pi-her', 'π Геркулеса', 17.2506, 36.8092, 3.16),
      S('eta-her', 'η Геркулеса', 16.7148, 38.9225, 3.48),
      S('mu-her', 'μ Геркулеса', 17.7745, 27.7204, 3.42),
      S('omicron-her', 'ο Геркулеса', 18.1401, 28.7625, 3.83),
      S('theta-her', 'θ Геркулеса', 17.9391, 37.2504, 3.86),
      S('iota-her', 'ι Геркулеса', 17.6612, 46.0064, 3.80)
    ],
    lines: [
      ['rasalgethi', 'sarin'], ['sarin', 'kornephoros'], ['kornephoros', 'gamma-her'],
      ['kornephoros', 'zeta-her'], ['sarin', 'epsilon-her'],
      ['zeta-her', 'eta-her'], ['eta-her', 'pi-her'], ['pi-her', 'epsilon-her'], ['epsilon-her', 'zeta-her'],
      ['epsilon-her', 'mu-her'], ['mu-her', 'omicron-her'],
      ['pi-her', 'theta-her'], ['theta-her', 'iota-her']
    ]
  },
  {
    id: 'ophiuchus', name: 'Змееносец',
    stars: [
      S('rasalhague', 'Рас Альхаге', 17.5822, 12.5600, 2.08),
      S('cebalrai', 'Цебальрай', 17.7243, 4.5673, 2.76),
      S('gamma-oph', 'γ Змееносца', 17.7979, 2.7071, 3.75),
      S('kappa-oph', 'κ Змееносца', 16.9612, 9.3750, 3.20),
      S('yed-prior', 'Йед Приор', 16.2393, -3.6941, 2.73),
      S('yed-post', 'Йед Постериор', 16.3041, -4.6924, 3.23),
      S('zeta-oph', 'ζ Змееносца', 16.6191, -10.5671, 2.56),
      S('sabik', 'Сабик', 17.1729, -15.7250, 2.43),
      S('theta-oph', 'θ Змееносца', 17.3678, -25.0004, 3.27),
      S('nu-oph', 'ν Змееносца', 17.9844, -9.7734, 3.32)
    ],
    lines: [
      ['rasalhague', 'kappa-oph'], ['rasalhague', 'cebalrai'], ['cebalrai', 'gamma-oph'],
      ['gamma-oph', 'nu-oph'], ['nu-oph', 'sabik'], ['sabik', 'zeta-oph'],
      ['zeta-oph', 'yed-post'], ['yed-post', 'yed-prior'], ['yed-prior', 'kappa-oph'],
      ['sabik', 'theta-oph']
    ]
  },
  {
    id: 'draco', name: 'Дракон',
    stars: [
      S('thuban', 'Тубан', 14.0731, 64.3758, 3.65),
      S('rastaban', 'Растабан', 17.5072, 52.3014, 2.79),
      S('eltanin', 'Этамин', 17.9434, 51.4889, 2.23),
      S('grumium', 'Грумиум', 17.8925, 56.8727, 3.75),
      S('nu-dra', 'ν Дракона', 17.5372, 55.1734, 4.88),
      S('altais', 'Альтаис', 19.2093, 67.6615, 3.07),
      S('epsilon-dra', 'ε Дракона', 19.8021, 70.2679, 3.83),
      S('aldhibah', 'Альдибах', 17.1465, 65.7147, 3.17),
      S('athebyne', 'Атебина', 16.3999, 61.5141, 2.73),
      S('theta-dra', 'θ Дракона', 16.0356, 58.5648, 4.01),
      S('edasich', 'Эдасих', 15.4155, 58.9661, 3.29),
      S('kappa-dra', 'κ Дракона', 12.5583, 69.7881, 3.87),
      S('giausar', 'Гиауcар', 11.5211, 69.3312, 3.82)
    ],
    lines: [
      ['eltanin', 'rastaban'], ['rastaban', 'nu-dra'], ['nu-dra', 'grumium'], ['grumium', 'eltanin'],
      ['grumium', 'altais'], ['altais', 'epsilon-dra'], ['epsilon-dra', 'aldhibah'],
      ['aldhibah', 'athebyne'], ['athebyne', 'theta-dra'], ['theta-dra', 'edasich'],
      ['edasich', 'thuban'], ['thuban', 'kappa-dra'], ['kappa-dra', 'giausar']
    ]
  },
  {
    id: 'cepheus', name: 'Цефей',
    stars: [
      S('alderamin', 'Альдерамин', 21.3096, 62.5856, 2.45),
      S('alfirk', 'Альфирк', 21.4776, 70.5607, 3.23),
      S('errai', 'Эррай', 23.6559, 77.6323, 3.21),
      S('iota-cep', 'ι Цефея', 22.8283, 66.2003, 3.50),
      S('zeta-cep', 'ζ Цефея', 22.1810, 58.2012, 3.35),
      S('delta-cep', 'δ Цефея', 22.4909, 58.4152, 4.07),
      S('epsilon-cep', 'ε Цефея', 22.2500, 57.0435, 4.18),
      S('eta-cep', 'η Цефея', 20.7545, 61.8388, 3.43)
    ],
    lines: [
      ['alderamin', 'alfirk'], ['alfirk', 'errai'], ['errai', 'iota-cep'], ['iota-cep', 'zeta-cep'],
      ['zeta-cep', 'alderamin'], ['zeta-cep', 'delta-cep'], ['delta-cep', 'epsilon-cep'],
      ['epsilon-cep', 'zeta-cep'], ['alderamin', 'eta-cep']
    ]
  },
  {
    id: 'cetus', name: 'Кит',
    stars: [
      S('menkar', 'Менкар', 3.0380, 4.0899, 2.54),
      S('kaffaljidhma', 'Каффальджидма', 2.7213, 3.2358, 3.47),
      S('delta-cet', 'δ Кита', 2.6591, 0.3285, 4.07),
      S('mira', 'Мира', 2.3224, -2.9776, 3.00),
      S('baten-kaitos', 'Батен Кайтос', 1.8574, -10.3350, 3.73),
      S('tau-cet', 'τ Кита', 1.7345, -15.9375, 3.50),
      S('diphda', 'Дифда', 0.7265, -17.9866, 2.04),
      S('iota-cet', 'ι Кита', 0.3234, -8.8237, 3.56),
      S('eta-cet', 'η Кита', 1.1429, -10.1817, 3.45),
      S('theta-cet', 'θ Кита', 1.4001, -8.1838, 3.60),
      S('mu-cet', 'μ Кита', 2.7495, 10.1142, 4.27),
      S('lambda-cet', 'λ Кита', 2.9959, 8.9074, 4.70)
    ],
    lines: [
      ['menkar', 'lambda-cet'], ['lambda-cet', 'mu-cet'], ['mu-cet', 'kaffaljidhma'],
      ['kaffaljidhma', 'menkar'], ['kaffaljidhma', 'delta-cet'], ['delta-cet', 'mira'],
      ['mira', 'baten-kaitos'], ['baten-kaitos', 'tau-cet'], ['tau-cet', 'diphda'],
      ['diphda', 'iota-cet'], ['iota-cet', 'eta-cet'], ['eta-cet', 'theta-cet'], ['theta-cet', 'tau-cet']
    ]
  },
  {
    id: 'aries', name: 'Овен',
    stars: [
      S('hamal', 'Хамаль', 2.1195, 23.4624, 2.01),
      S('sheratan', 'Шератан', 1.9106, 20.8081, 2.64),
      S('mesarthim', 'Мезартим', 1.8925, 19.2941, 3.86),
      S('bharani', 'Барани', 2.8330, 27.2608, 3.61),
      S('botein', 'Ботейн', 3.1943, 19.7267, 4.35)
    ],
    lines: [['mesarthim', 'sheratan'], ['sheratan', 'hamal'], ['hamal', 'bharani'], ['bharani', 'botein']]
  },
  {
    id: 'pisces', name: 'Рыбы',
    stars: [
      S('alrescha', 'Альриша', 2.0339, 2.7638, 3.82),
      S('gamma-psc', 'γ Рыб', 23.2861, 3.2822, 3.69),
      S('kappa-psc', 'κ Рыб', 23.4438, 1.2557, 4.94),
      S('lambda-psc', 'λ Рыб', 23.7003, 1.7806, 4.50),
      S('iota-psc', 'ι Рыб', 23.6603, 5.6265, 4.13),
      S('theta-psc', 'θ Рыб', 23.4779, 6.3799, 4.28),
      S('omega-psc', 'ω Рыб', 23.9899, 6.8637, 4.01),
      S('delta-psc', 'δ Рыб', 0.8103, 7.5850, 4.43),
      S('epsilon-psc', 'ε Рыб', 1.0532, 7.8901, 4.27),
      S('nu-psc', 'ν Рыб', 1.6634, 5.4877, 4.44),
      S('omicron-psc', 'ο Рыб', 1.7770, 9.1580, 4.26),
      S('eta-psc', 'Альферг', 1.5248, 15.3459, 3.62),
      S('phi-psc', 'φ Рыб', 1.2226, 24.5835, 4.65),
      S('upsilon-psc', 'υ Рыб', 1.3227, 27.2641, 4.76),
      S('tau-psc', 'τ Рыб', 1.1926, 30.0896, 4.51)
    ],
    lines: [
      ['gamma-psc', 'kappa-psc'], ['kappa-psc', 'lambda-psc'], ['lambda-psc', 'iota-psc'],
      ['iota-psc', 'theta-psc'], ['theta-psc', 'gamma-psc'],
      ['iota-psc', 'omega-psc'], ['omega-psc', 'delta-psc'], ['delta-psc', 'epsilon-psc'],
      ['epsilon-psc', 'nu-psc'], ['nu-psc', 'alrescha'],
      ['alrescha', 'omicron-psc'], ['omicron-psc', 'eta-psc'], ['eta-psc', 'phi-psc'],
      ['phi-psc', 'upsilon-psc'], ['upsilon-psc', 'tau-psc']
    ]
  },
  {
    id: 'aquarius', name: 'Водолей',
    stars: [
      S('sadalsuud', 'Садальсууд', 21.5260, -5.5712, 2.90),
      S('sadalmelik', 'Садальмелик', 22.0964, -0.3199, 2.95),
      S('sadachbia', 'Садахбия', 22.3617, -1.3873, 3.84),
      S('zeta-aqr', 'ζ Водолея', 22.4805, -0.0201, 3.65),
      S('eta-aqr', 'η Водолея', 22.5877, -0.1200, 4.02),
      S('pi-aqr', 'π Водолея', 22.4200, 1.3773, 4.66),
      S('theta-aqr', 'θ Водолея', 22.2822, -7.7833, 4.16),
      S('lambda-aqr', 'λ Водолея', 22.8767, -7.5797, 3.74),
      S('tau-aqr', 'τ Водолея', 22.8768, -13.5928, 4.01),
      S('phi-aqr', 'φ Водолея', 23.2258, -6.0490, 4.22),
      S('skat', 'Скат', 22.9109, -15.8208, 3.27),
      S('albali', 'Альбали', 20.7947, -9.4958, 3.77)
    ],
    lines: [
      ['albali', 'sadalsuud'], ['sadalsuud', 'sadalmelik'], ['sadalmelik', 'sadachbia'],
      ['sadachbia', 'zeta-aqr'], ['zeta-aqr', 'eta-aqr'], ['zeta-aqr', 'pi-aqr'],
      ['sadalmelik', 'theta-aqr'], ['theta-aqr', 'lambda-aqr'], ['lambda-aqr', 'tau-aqr'],
      ['lambda-aqr', 'phi-aqr'], ['lambda-aqr', 'skat']
    ]
  },
  {
    id: 'capricornus', name: 'Козерог',
    stars: [
      S('algedi', 'Альгеди', 20.3003, -12.5083, 3.57),
      S('dabih', 'Дабих', 20.3502, -14.7814, 3.05),
      S('psi-cap', 'ψ Козерога', 20.7690, -25.2705, 4.13),
      S('omega-cap', 'ω Козерога', 20.8628, -26.9192, 4.11),
      S('zeta-cap', 'ζ Козерога', 21.4448, -22.4113, 3.74),
      S('nashira', 'Нашира', 21.6682, -16.6623, 3.68),
      S('deneb-algedi', 'Денеб Альгеди', 21.7840, -16.1273, 2.85),
      S('iota-cap', 'ι Козерога', 21.3714, -16.8347, 4.27),
      S('theta-cap', 'θ Козерога', 21.0983, -17.2329, 4.07)
    ],
    lines: [
      ['algedi', 'dabih'], ['dabih', 'psi-cap'], ['psi-cap', 'omega-cap'], ['omega-cap', 'zeta-cap'],
      ['zeta-cap', 'nashira'], ['nashira', 'deneb-algedi'], ['deneb-algedi', 'iota-cap'],
      ['iota-cap', 'theta-cap'], ['theta-cap', 'algedi']
    ]
  },
  {
    id: 'libra', name: 'Весы',
    stars: [
      S('zubenelgenubi', 'Зубен Эльгенуби', 14.8479, -16.0418, 2.75),
      S('zubeneschamali', 'Зубен Эшамали', 15.2833, -9.3830, 2.61),
      S('zubenelakrab', 'Зубен Эльакраб', 15.5859, -14.7895, 3.91),
      S('brachium', 'Брахиум', 15.0684, -25.2819, 3.29),
      S('upsilon-lib', 'υ Весов', 15.6153, -28.1350, 3.58),
      S('tau-lib', 'τ Весов', 15.6072, -29.7772, 3.66)
    ],
    lines: [
      ['zubenelgenubi', 'zubeneschamali'], ['zubeneschamali', 'zubenelakrab'],
      ['zubenelakrab', 'zubenelgenubi'], ['zubenelgenubi', 'brachium'],
      ['zubenelakrab', 'upsilon-lib'], ['upsilon-lib', 'tau-lib']
    ]
  },
  {
    id: 'cancer', name: 'Рак',
    stars: [
      S('altarf', 'Альтарф', 8.2751, 9.1856, 3.53),
      S('asellus-australis', 'Азеллюс Аустралис', 8.7446, 18.1543, 3.94),
      S('asellus-borealis', 'Азеллюс Бореалис', 8.7212, 21.4685, 4.66),
      S('acubens', 'Акубенс', 8.9746, 11.8577, 4.26),
      S('iota-cnc', 'ι Рака', 8.7793, 28.7602, 4.02)
    ],
    lines: [
      ['altarf', 'asellus-australis'], ['asellus-australis', 'asellus-borealis'],
      ['asellus-borealis', 'iota-cnc'], ['asellus-australis', 'acubens']
    ]
  },
  {
    id: 'canis-minor', name: 'Малый Пёс',
    stars: [
      S('procyon', 'Процион', 7.6550, 5.2250, 0.34),
      S('gomeisa', 'Гомейса', 7.4527, 8.2893, 2.89),
      S('gamma-cmi', 'γ Малого Пса', 7.4713, 8.9254, 4.32)
    ],
    lines: [['procyon', 'gomeisa'], ['gomeisa', 'gamma-cmi']]
  },
  {
    id: 'lupus', name: 'Волк',
    stars: [
      S('alpha-lup', 'α Волка', 14.6989, -47.3882, 2.30),
      S('beta-lup', 'β Волка', 14.9758, -43.1340, 2.68),
      S('gamma-lup', 'γ Волка', 15.5854, -41.1667, 2.78),
      S('delta-lup', 'δ Волка', 15.3565, -40.6475, 3.22),
      S('epsilon-lup', 'ε Волка', 15.3789, -44.6897, 3.37),
      S('zeta-lup', 'ζ Волка', 15.2116, -52.0991, 3.41),
      S('eta-lup', 'η Волка', 16.0068, -38.3964, 3.41),
      S('phi-lup', 'φ Волка', 15.3627, -36.2614, 3.56)
    ],
    lines: [
      ['alpha-lup', 'beta-lup'], ['beta-lup', 'epsilon-lup'], ['epsilon-lup', 'gamma-lup'],
      ['gamma-lup', 'delta-lup'], ['delta-lup', 'beta-lup'], ['gamma-lup', 'eta-lup'],
      ['delta-lup', 'phi-lup'], ['alpha-lup', 'zeta-lup']
    ]
  }
];

// Россыпи: три-пять настоящих звёзд без фигуры. Нужны ровно для того, чтобы между большими
// созвездиями не было мёртвых секторов: поворачиваешь телефон — и песок подхватывает хотя бы
// горсть звёзд. Линий у них нет: это не рисунок, а зацепка для взгляда.
export const SCATTERS = [
  { id: 'coma', name: 'Волосы Вероники', stars: [S('gamma-com', '', 12.4478, 28.2683, 4.35), S('12-com', '', 12.3792, 25.8478, 4.80), S('beta-com', '', 13.1979, 27.8781, 4.26), S('alpha-com', '', 13.1668, 17.5292, 4.32)] },
  { id: 'delphinus', name: 'Дельфин', stars: [S('sualocin', '', 20.6606, 15.9121, 3.77), S('rotanev', '', 20.6254, 14.5953, 3.63), S('gamma-del', '', 20.7867, 16.1242, 4.27), S('delta-del', '', 20.7278, 15.0746, 4.43), S('epsilon-del', '', 20.5566, 11.3033, 4.03)] },
  { id: 'sagitta', name: 'Стрела', stars: [S('gamma-sge', '', 19.9791, 19.4924, 3.47), S('delta-sge', '', 19.7900, 18.5341, 3.82), S('alpha-sge', '', 19.6684, 18.0139, 4.37), S('beta-sge', '', 19.6786, 17.4761, 4.37)] },
  { id: 'triangulum', name: 'Треугольник', stars: [S('beta-tri', '', 2.1597, 34.9871, 3.00), S('alpha-tri', '', 1.8846, 29.5792, 3.41), S('gamma-tri', '', 2.2886, 33.8473, 4.01)] },
  { id: 'canes', name: 'Гончие Псы', stars: [S('cor-caroli', '', 12.9338, 38.3183, 2.89), S('chara', '', 12.5622, 41.3576, 4.24), S('20-cvn', '', 13.2986, 40.5736, 4.73)] },
  { id: 'lacerta', name: 'Ящерица', stars: [S('alpha-lac', '', 22.5210, 50.2825, 3.77), S('beta-lac', '', 22.3936, 52.2291, 4.42), S('4-lac', '', 22.4001, 49.4785, 4.55), S('5-lac', '', 22.4934, 47.7079, 4.34)] },
  { id: 'corvus', name: 'Ворон', stars: [S('gienah', '', 12.2634, -17.5419, 2.59), S('kraz', '', 12.5735, -23.3968, 2.65), S('algorab', '', 12.4979, -16.5151, 2.95), S('minkar', '', 12.1684, -22.6197, 3.00), S('alchiba', '', 12.1402, -24.7288, 4.02)] },
  { id: 'crater', name: 'Чаша', stars: [S('labrum', '', 11.3222, -14.7788, 3.56), S('alkes', '', 10.9962, -18.2988, 4.07), S('gamma-crt', '', 11.4147, -17.6842, 4.06), S('beta-crt', '', 11.1946, -22.8261, 4.46)] },
  { id: 'hydra-head', name: 'Голова Гидры', stars: [S('zeta-hya', '', 8.9209, 5.9456, 3.11), S('epsilon-hya', '', 8.7793, 6.4188, 3.38), S('delta-hya', '', 8.6291, 5.7036, 4.14), S('sigma-hya', '', 8.6449, 3.3411, 4.44), S('eta-hya', '', 8.7198, 3.3993, 4.30)] },
  { id: 'alphard', name: 'Альфард', stars: [S('alphard', '', 9.4597, -8.6586, 1.98), S('lambda-hya', '', 10.1085, -12.3541, 3.61), S('upsilon-hya', '', 9.8593, -14.8465, 4.12)] },
  { id: 'monoceros', name: 'Единорог', stars: [S('alpha-mon', '', 7.6858, -9.5508, 3.93), S('beta-mon', '', 6.4805, -7.0333, 3.76), S('gamma-mon', '', 6.2478, -6.2747, 3.98), S('delta-mon', '', 7.1968, -0.4935, 4.15)] },
  { id: 'lepus', name: 'Заяц', stars: [S('arneb', '', 5.5455, -17.8222, 2.58), S('nihal', '', 5.4707, -20.7594, 2.81), S('epsilon-lep', '', 5.0929, -22.3714, 3.19), S('mu-lep', '', 5.2130, -16.2054, 3.31), S('gamma-lep', '', 5.7444, -22.4481, 3.60), S('delta-lep', '', 5.8553, -20.8794, 3.81)] },
  { id: 'equuleus', name: 'Малый Конь', stars: [S('kitalpha', '', 21.2626, 5.2480, 3.92), S('delta-equ', '', 21.2394, 10.0071, 4.49), S('gamma-equ', '', 21.1727, 10.1319, 4.69)] },
  { id: 'serpens-head', name: 'Голова Змеи', stars: [S('unukalhai', '', 15.7379, 6.4256, 2.63), S('mu-ser', '', 15.8262, -3.4301, 3.53), S('beta-ser', '', 15.7696, 15.4220, 3.65), S('epsilon-ser', '', 15.8467, 4.4777, 3.71), S('delta-ser', '', 15.5800, 10.5389, 3.80), S('gamma-ser', '', 15.9440, 15.6618, 3.85)] },
  { id: 'serpens-tail', name: 'Хвост Змеи', stars: [S('alya', '', 18.3551, -2.8987, 3.26), S('theta-ser', '', 18.9356, 4.2036, 4.62), S('xi-ser', '', 17.9683, -15.3987, 3.54), S('nu-ser', '', 17.5230, -12.8461, 4.32)] },
  { id: 'camelopardalis', name: 'Жираф', stars: [S('beta-cam', '', 5.0570, 60.4422, 4.03), S('alpha-cam', '', 4.9000, 66.3428, 4.29), S('gamma-cam', '', 3.8390, 71.3324, 4.63), S('cs-cam', '', 3.4514, 59.9401, 4.21)] },
  { id: 'lynx', name: 'Рысь', stars: [S('alpha-lyn', '', 9.3508, 34.3925, 3.13), S('38-lyn', '', 9.3110, 36.8025, 3.82), S('31-lyn', '', 8.3855, 43.1883, 4.25), S('21-lyn', '', 7.4404, 49.2117, 4.48), S('15-lyn', '', 6.9535, 58.4229, 4.35)] },
  { id: 'pisces-austrinus', name: 'Южная Рыба', stars: [S('fomalhaut', '', 22.9608, -29.6222, 1.16), S('epsilon-psa', '', 22.6767, -27.0437, 4.17), S('delta-psa', '', 22.9355, -32.5395, 4.21), S('beta-psa', '', 22.5253, -32.3460, 4.29)] },
  { id: 'eridanus-north', name: 'Эридан', stars: [S('cursa', '', 5.1305, -5.0864, 2.79), S('lambda-eri', '', 5.1524, -8.7542, 4.27), S('mu-eri', '', 4.7639, -3.2545, 4.02), S('nu-eri', '', 4.6019, -3.3524, 3.93), S('omicron1-eri', '', 4.1953, -6.8383, 4.04)] },
  { id: 'vulpecula', name: 'Лисичка', stars: [S('anser', '', 19.4785, 24.6650, 4.44), S('13-vul', '', 19.9226, 24.0755, 4.57), S('15-vul', '', 20.0173, 27.8118, 4.64)] }
];

export const LATIN_EXTRA = {
  hercules: 'HERCULES', ophiuchus: 'OPHIUCHUS', draco: 'DRACO', cepheus: 'CEPHEUS',
  cetus: 'CETUS', aries: 'ARIES', pisces: 'PISCES', aquarius: 'AQUARIUS',
  capricornus: 'CAPRICORNUS', libra: 'LIBRA', cancer: 'CANCER',
  'canis-minor': 'CANIS MINOR', lupus: 'LUPUS',
  coma: 'COMA BERENICES', delphinus: 'DELPHINUS', sagitta: 'SAGITTA', triangulum: 'TRIANGULUM',
  canes: 'CANES VENATICI', lacerta: 'LACERTA', corvus: 'CORVUS', crater: 'CRATER',
  'hydra-head': 'HYDRA', alphard: 'HYDRA', monoceros: 'MONOCEROS', lepus: 'LEPUS',
  equuleus: 'EQUULEUS', 'serpens-head': 'SERPENS CAPUT', 'serpens-tail': 'SERPENS CAUDA',
  camelopardalis: 'CAMELOPARDALIS', lynx: 'LYNX', 'pisces-austrinus': 'PISCIS AUSTRINUS',
  'eridanus-north': 'ERIDANUS', vulpecula: 'VULPECULA'
};
