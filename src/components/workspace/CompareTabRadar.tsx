import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import { COMPARE_RADAR_COLORS } from '../../lib/compareCriteria'
import type { Json } from '../../types/database'

type Candidate = {
  id: string
  brand: string
  model: string
  candidate_specs: { specs: Json } | null
}

type Props = {
  radarData: Record<string, string | number>[]
  picked: Candidate[]
}

export default function CompareTabRadar({ radarData, picked }: Props) {
  return (
    <div className="radar-wrap" style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>
        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="80%">
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" />
          <PolarRadiusAxis angle={30} domain={[0, 100]} />
          {picked.map((p, i) => (
            <Radar
              key={p.id}
              name={`${p.brand} ${p.model}`.trim()}
              dataKey={p.id}
              stroke={COMPARE_RADAR_COLORS[i % COMPARE_RADAR_COLORS.length]}
              fill={COMPARE_RADAR_COLORS[i % COMPARE_RADAR_COLORS.length]}
              fillOpacity={0.2}
            />
          ))}
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
