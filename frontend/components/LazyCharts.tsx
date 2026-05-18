'use client';
/**
 * LazyCharts — single dynamic import point for Recharts.
 * Import chart components from here instead of 'recharts' directly.
 * Next.js will code-split this into ONE shared chunk used across all pages.
 */
export {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
  ResponsiveContainer,
  LabelList,
  ComposedChart,
  ScatterChart, Scatter,
  RadialBarChart, RadialBar,
} from 'recharts';
