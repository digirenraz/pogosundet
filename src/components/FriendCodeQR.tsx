import QRCodeLib from 'qrcode';

interface FriendCodeQRProps {
  value: string;
  size?: number;
}

// Renders a real, scannable QR encoding the friend code as an SVG.
// Pokémon GO's in-app scanner accepts plain-numeric QRs but is strict about
// whitespace, so we strip non-digits before encoding. As a side effect this
// also lets `qrcode` use its denser "numeric" mode.
// Server-renderable: qrcode's `create()` API is synchronous.
// The four teal corner markers from the design overlay the SVG.
export function FriendCodeQR({ value, size = 224 }: FriendCodeQRProps) {
  const digits = value.replace(/\D/g, '');
  const qr = QRCodeLib.create(digits, { errorCorrectionLevel: 'M' });
  const N = qr.modules.size;
  const data = qr.modules.data;
  const quietZone = 8;
  const drawable = size - quietZone * 2;
  const cell = drawable / N;

  const rects: React.ReactElement[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (data[r * N + c]) {
        rects.push(
          <rect
            key={`${r}-${c}`}
            x={quietZone + c * cell}
            y={quietZone + r * cell}
            width={cell + 0.4}
            height={cell + 0.4}
            fill="#000"
          />
        );
      }
    }
  }

  // Four teal L-shaped corner markers from DetailScreen.jsx — purely decorative.
  const markerSize = 14;
  const markerStroke = 3;
  const corners = [
    { side: 't', edge: 'l', top: -markerStroke, left: -markerStroke },
    { side: 't', edge: 'r', top: -markerStroke, right: -markerStroke },
    { side: 'b', edge: 'l', bottom: -markerStroke, left: -markerStroke },
    { side: 'b', edge: 'r', bottom: -markerStroke, right: -markerStroke },
  ] as const;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
        className="block rounded-md bg-background"
      >
        <rect width={size} height={size} fill="#fff" />
        {rects}
      </svg>
      {corners.map((c, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            width: markerSize,
            height: markerSize,
            borderColor: 'var(--color-primary)',
            borderStyle: 'solid',
            borderTopWidth: c.side === 't' ? markerStroke : 0,
            borderBottomWidth: c.side === 'b' ? markerStroke : 0,
            borderLeftWidth: c.edge === 'l' ? markerStroke : 0,
            borderRightWidth: c.edge === 'r' ? markerStroke : 0,
            top: 'top' in c ? c.top : undefined,
            bottom: 'bottom' in c ? c.bottom : undefined,
            left: 'left' in c ? c.left : undefined,
            right: 'right' in c ? c.right : undefined,
            borderRadius: 3,
          }}
        />
      ))}
    </div>
  );
}
