import { Rect, Svg } from 'proto-components/svg';

// The Prototo mark, still: the same 5x5 pixel grid as assets/logo-prototo.json.
const PINK = '#E86A9C';
const LIGHT = '#F0E4E8';
const CELLS: [number, number, string][] = [
  [2, 0, PINK],
  [1, 1, PINK], [2, 1, LIGHT], [3, 1, PINK],
  [0, 2, PINK], [1, 2, LIGHT], [3, 2, LIGHT], [4, 2, PINK],
  [0, 3, LIGHT], [4, 3, LIGHT],
];

export function ProtoMark({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 5 5">
      {CELLS.map(([x, y, fill]) => (
        <Rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />
      ))}
    </Svg>
  );
}
