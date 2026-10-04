#!/usr/bin/env python3
# Строитель видеоключей экрана Hello «Кофейной гущи».
#
# Из Refs/hello-video.mp4 (1080x1920, 60 fps, 8 c) делает dist/gusha/hello-frames.bin —
# сто шестьдесят полутоновых кадров 120x212 при 20 fps, один байт яркости на пиксель.
# Рантайм (dist/gusha/hello-frames.js) читает их как ключи и раздаёт песку цели:
# светлое — плотный песок, тёмное — пусто, сквозь него видно небо.
#
# Почему предрасчёт, а не <video> в рантайме: WebKit в headless не всегда декодирует mp4,
# а исходник весит 14 МБ. Здесь 4 МБ, одинаково работает везде, и живое видео остаётся
# необязательной надстройкой.
#
# Запуск: python3 scripts/build-hello-frames.py   (нужен ffmpeg в PATH)

import os, subprocess, sys, struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'Refs', 'hello-video.mp4')
OUT  = os.path.join(ROOT, 'dist', 'gusha', 'hello-frames.bin')
TMP  = os.environ.get('HELLO_TMP', '/tmp')

W, H, FPS, N = 120, 212, 20, 160

# Кадрирование. Исходник снят широко: стакан занимает шестую часть ширины, а низ кадра съедает
# яркая решётка поддона. В Figma кадр взят вдвое ближе — группа, струя и стакан. Повторяем: окно
# 680x1204 (то же отношение 120:212) с центром на стакане.
CROP_W, CROP_H = 680, 1204
CROP_X, CROP_Y = 124, 454

# Тональная коррекция. Уровни считаем по всей последовательности сразу, а не по каждому кадру:
# покадровая нормализация заставила бы картинку дышать яркостью там, где видео ровное.
LO_PCT, HI_PCT = 0.16, 0.995   # сохраняем тени машины и полутона стакана
GAMMA = 1.35                    # лёгкое сжатие середины без потери объёма
FLOOR = 4                       # отсекаем только самый тёмный шум


def run(cmd, **kw):
    p = subprocess.run(cmd, **kw)
    if p.returncode != 0:
        sys.exit('ffmpeg упал: ' + ' '.join(cmd))
    return p


def extract():
    raw = os.path.join(TMP, 'hello-raw.gray')
    vf = (f'crop={CROP_W}:{CROP_H}:{CROP_X}:{CROP_Y},fps={FPS},'
          f'scale={W}:{H}:flags=lanczos,format=gray')
    run(['ffmpeg', '-v', 'error', '-y', '-i', SRC, '-vf', vf,
         '-frames:v', str(N), '-f', 'rawvideo', '-pix_fmt', 'gray', raw])
    data = bytearray(open(raw, 'rb').read())
    need = W * H * N
    if len(data) < need:                       # последний кадр короче — дотягиваем повтором
        last = data[-W * H:]
        while len(data) < need:
            data.extend(last)
    return bytes(data[:need])


def levels(data):
    hist = [0] * 256
    for b in data:
        hist[b] += 1
    total = len(data)
    lo = hi = 0
    acc = 0
    for v in range(256):
        acc += hist[v]
        if acc <= total * LO_PCT:
            lo = v
        if acc <= total * HI_PCT:
            hi = v
    hi = max(hi, lo + 1)
    return lo, hi


def grade(data, lo, hi):
    lut = bytearray(256)
    span = hi - lo
    for v in range(256):
        t = (v - lo) / span
        t = 0.0 if t < 0 else 1.0 if t > 1 else t
        y = int(round(255 * (t ** GAMMA)))
        lut[v] = 0 if y < FLOOR else y
    return bytes(lut[b] for b in data)


def main():
    if not os.path.exists(SRC):
        sys.exit('нет исходника: ' + SRC)
    raw = extract()
    lo, hi = levels(raw)
    out = grade(raw, lo, hi)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    # Заголовок: 'HSF1' + w,h,fps,n (uint16 LE). Дальше n*w*h байт яркости, строки сверху вниз.
    with open(OUT, 'wb') as f:
        f.write(b'HSF1' + struct.pack('<HHHH', W, H, FPS, N))
        f.write(out)
    lit = sum(1 for b in out if b) / len(out)
    print(f'{OUT}: {W}x{H} {FPS}fps {N} кадров, уровни {lo}..{hi}, '
          f'песка {lit*100:.1f}% площади, {os.path.getsize(OUT)/1024:.0f} КБ')
    # Контакт-лист для глазной проверки
    sheet = os.path.join(TMP, 'hello-sheet.png')
    proc = os.path.join(TMP, 'hello-graded.gray')
    open(proc, 'wb').write(out)
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray',
         '-s', f'{W}x{H}', '-r', str(FPS), '-i', proc,
         '-vf', f'select=not(mod(n\\,5)),scale={W*2}:{H*2}:flags=neighbor,tile=4x4',
         '-frames:v', '1', sheet])
    print('контакт-лист:', sheet)


main()
