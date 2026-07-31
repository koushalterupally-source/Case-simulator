import React from 'react';
import { ORDER_GROUPS, HISTORY_PROMPTS, EXAM_SYSTEMS } from '../../data/orderSets';

interface OrderSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (command: string) => void;
}

type Tab = 'orders' | 'history' | 'exam';

/**
 * The order sheet: pick from the catalogue, stack up a basket, place it in one
 * go — the way a real order set works. Typing free text still exists in the
 * composer, but nothing should require it.
 */
export const OrderSheet: React.FC<OrderSheetProps> = ({ open, onClose, onSubmit }) => {
  const [tab, setTab] = React.useState<Tab>('orders');
  const [groupId, setGroupId] = React.useState(ORDER_GROUPS[0].id);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      setSelected([]);
      setQuery('');
    }
  }, [open]);

  if (!open) return null;

  const toggle = (item: string) =>
    setSelected((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));

  const q = query.trim().toLowerCase();
  const group = ORDER_GROUPS.find((g) => g.id === groupId) || ORDER_GROUPS[0];

  // Searching looks across every group, not just the open one.
  const searchHits = q
    ? ORDER_GROUPS.flatMap((g) =>
        g.sections.flatMap((s) =>
          s.items.filter((i) => i.toLowerCase().includes(q)).map((i) => ({ group: g.label, item: i }))
        )
      )
    : [];

  const place = () => {
    if (selected.length === 0) return;
    onSubmit(`order: ${selected.join(', ')}`);
    setSelected([]);
    onClose();
  };

  const Pill: React.FC<{ item: string }> = ({ item }) => {
    const on = selected.includes(item);
    return (
      <button
        onClick={() => toggle(item)}
        className="text-left rounded-xl px-3 py-2 text-[14px] transition-colors ring-focus"
        style={{
          background: on ? 'var(--accent-soft)' : 'var(--bg)',
          border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
          color: on ? 'var(--accent)' : 'var(--text)',
        }}
      >
        {item}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end sm:items-center sm:justify-center">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.35)' }} onClick={onClose} />

      <div
        className="relative w-full sm:max-w-[42rem] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          maxHeight: '86vh',
        }}
      >
        {/* Tabs */}
        <div className="flex items-center gap-1 px-3 pt-3" style={{ borderBottom: '1px solid var(--border)' }}>
          {([
            ['orders', 'Orders'],
            ['history', 'History'],
            ['exam', 'Examination'],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="px-3 py-2 text-[14px] rounded-t-lg ring-focus"
              style={{
                color: tab === id ? 'var(--text)' : 'var(--text-muted)',
                borderBottom: `2px solid ${tab === id ? 'var(--accent)' : 'transparent'}`,
                fontWeight: tab === id ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto mb-1 w-8 h-8 rounded-full ring-focus"
            style={{ color: 'var(--text-faint)' }}
          >
            ×
          </button>
        </div>

        {tab === 'orders' && (
          <>
            <div className="px-4 pt-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search orders — abg, lft, ct, saline…"
                className="w-full rounded-xl px-3.5 py-2 text-[14px] ring-focus"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>

            {!q && (
              <div className="flex gap-1.5 overflow-x-auto px-4 pt-3 pb-1">
                {ORDER_GROUPS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGroupId(g.id)}
                    className="shrink-0 rounded-full px-3 py-1.5 text-[13px] ring-focus"
                    style={{
                      background: g.id === groupId ? 'var(--text)' : 'var(--bg)',
                      color: g.id === groupId ? 'var(--bg)' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {q ? (
                searchHits.length === 0 ? (
                  <p className="text-[14px]" style={{ color: 'var(--text-faint)' }}>
                    Nothing matches “{query}”. You can still type it in the box below.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {searchHits.map(({ item }) => (
                      <Pill key={item} item={item} />
                    ))}
                  </div>
                )
              ) : (
                group.sections.map((s) => (
                  <div key={s.label} className="mb-5">
                    <div
                      className="text-[12px] uppercase tracking-wide mb-2"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      {s.label}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {s.items.map((item) => (
                        <Pill key={item} item={item} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              <span className="text-[13px] flex-1" style={{ color: 'var(--text-muted)' }}>
                {selected.length === 0 ? 'Nothing selected' : `${selected.length} selected`}
              </span>
              {selected.length > 0 && (
                <button
                  onClick={() => setSelected([])}
                  className="text-[13px] ring-focus rounded px-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Clear
                </button>
              )}
              <button
                onClick={place}
                disabled={selected.length === 0}
                className="rounded-xl px-5 py-2.5 text-[14px] font-medium ring-focus disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Place orders
              </button>
            </div>
          </>
        )}

        {tab === 'history' && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {['Presenting complaint', 'Background'].map((section) => (
              <div key={section} className="mb-5">
                <div className="text-[12px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>
                  {section}
                </div>
                <div className="space-y-2">
                  {HISTORY_PROMPTS.filter((h) => h.section === section).map((h) => (
                    <button
                      key={h.label}
                      onClick={() => {
                        onSubmit(`hx: ${h.label}`);
                        onClose();
                      }}
                      className="w-full text-left rounded-xl px-3.5 py-2.5 text-[14px] ring-focus"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'exam' && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXAM_SYSTEMS.map((sys) => (
                <button
                  key={sys}
                  onClick={() => {
                    onSubmit(`pe: ${sys}`);
                    onClose();
                  }}
                  className="text-left rounded-xl px-3.5 py-2.5 text-[14px] ring-focus"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                >
                  {sys}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
