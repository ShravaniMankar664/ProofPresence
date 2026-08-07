import type { ComponentType } from 'react';
import type { Insights } from '../types';
import { Ring } from './Ring';
import { CountUp } from './CountUp';
import { ChartIcon, ClockIcon, SparklesIcon, UsersIcon, CertIcon } from './icons';

export function InsightsPanel({ insights, compact = false }: { insights: Insights; compact?: boolean }) {
  return (
    <div>
      <div className="grid grid-4">
        <Metric
          icon={UsersIcon}
          label="Attendance rate"
          value={`${insights.attendanceRate}%`}
          sub={insights.labels.attendanceRate}
          color="var(--cyan)"
        />
        <Metric
          icon={ClockIcon}
          label="Peak check-in"
          value={insights.peakCheckinWindow ?? '—'}
          sub={insights.labels.peakCheckinWindow}
          color="var(--amber)"
        />
        <Metric
          icon={SparklesIcon}
          label="On-time rate"
          value={`${insights.onTimeRate}%`}
          sub={insights.labels.onTimeRate}
          color="var(--green)"
        />
        <Metric
          icon={CertIcon}
          label="Certificate completion"
          value={`${insights.certCompletion}%`}
          sub={insights.labels.certCompletion}
          color="var(--pink)"
        />
      </div>

      <div className="grid-2" style={{ display: 'grid', gap: 18, marginTop: 18 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <div className="card-title">
              <ChartIcon size={17} /> Check-in distribution
            </div>
            <span className="badge badge-cyan">live</span>
          </div>
          <p className="card-sub" style={{ marginBottom: 14 }}>Attendees per hour of day</p>
          <Histogram data={insights.checkinHistogram} peakHour={insights.peakCheckinHour} />
        </div>

        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <div className="card-title" style={{ marginBottom: 18, alignSelf: 'flex-start' }}>
            <SparklesIcon size={17} /> Engagement score
          </div>
          <Ring value={insights.engagementScore} size={140} stroke={12} />
          <div style={{ marginTop: 30, fontSize: 12.5, textAlign: 'center', maxWidth: 260 }} className="muted">
            {insights.labels.engagementScore}
          </div>
        </div>
      </div>

      {!compact && (
        <div className="grid grid-4 mt-2">
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
              <CountUp value={insights.attendance} />
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Total check-ins</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
              <CountUp value={100 - insights.attendanceRate} suffix="%" />
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Remaining capacity</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
              <CountUp value={insights.attendance > 0 ? Math.round(insights.certCompletion) : 0} suffix="%" />
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Verified certificates</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
              <CountUp value={insights.onTimeRate} suffix="%" />
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>On-time attendance</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon size={17} />
        <span style={{ fontSize: 12.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.05, color: 'var(--muted)' }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color }}>
        {value}
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{sub}</div>
    </div>
  );
}

export function Histogram({ data, peakHour }: { data: { hour: number; count: number }[]; peakHour: number | null }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="chart">
        {data.map((d) => (
          <div
            key={d.hour}
            className={`chart-bar ${d.hour === peakHour ? 'peak' : ''}`}
            style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }}
            title={`${String(d.hour).padStart(2, '0')}:00 — ${d.count} check-in${d.count === 1 ? '' : 's'}`}
          />
        ))}
      </div>
      <div className="chart-x">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}
