/**
 * Proper base-10 (MAB/Dienes) blocks: hundreds = big gridded squares,
 * tens = tall rods with segment lines, ones = small squares.
 */
export function BaseTenBlocks({ h, t, o }: { h: number; t: number; o: number }) {
  return (
    <div className="btb">
      {h > 0 && (
        <div className="btb-group">
          {Array.from({ length: h }, (_, i) => <span key={i} className="btb-hundred" />)}
        </div>
      )}
      {t > 0 && (
        <div className="btb-group">
          {Array.from({ length: t }, (_, i) => <span key={i} className="btb-ten" />)}
        </div>
      )}
      {o > 0 && (
        <div className="btb-group">
          {Array.from({ length: o }, (_, i) => <span key={i} className="btb-one" />)}
        </div>
      )}
    </div>
  );
}
