import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { DevColors, DevSpacing } from '../../constants/developerTheme';
import { type DeveloperUsageBucket, type DeveloperEndpointUsage } from '../../services/developer';

function useChartWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (event: { nativeEvent: { layout: { width: number } } }) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };
  return { width, onLayout };
}

function axisLabel(bucketStart: string, bucket: 'hour' | 'day'): string {
  const date = new Date(bucketStart);
  if (Number.isNaN(date.getTime())) return '';
  if (bucket === 'hour') {
    return `${String(date.getHours()).padStart(2, '0')}:00`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function labelIndices(count: number): number[] {
  if (count <= 1) return [0];
  const candidates = [0, Math.round((count - 1) / 3), Math.round(((count - 1) * 2) / 3), count - 1];
  return Array.from(new Set(candidates));
}

interface SeriesChartProps {
  data: DeveloperUsageBucket[];
  bucket: 'hour' | 'day';
  height?: number;
}

export function RequestsOverTimeChart({ data, bucket, height = 210 }: SeriesChartProps) {
  const { width, onLayout } = useChartWidth();
  const total = data.reduce((sum, point) => sum + point.requests, 0);
  const max = Math.max(1, ...data.map((point) => point.requests));
  const padding = { top: 14, right: 8, bottom: 24, left: 8 };
  const plotWidth = Math.max(0, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;
  const baseline = padding.top + plotHeight;

  const pointAt = (value: number, index: number) => {
    const x =
      data.length <= 1
        ? padding.left + plotWidth / 2
        : padding.left + (index / (data.length - 1)) * plotWidth;
    const y = padding.top + plotHeight - (value / max) * plotHeight;
    return { x, y };
  };

  const points = data.map((point, index) => pointAt(point.requests, index));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`
      : '';

  return (
    <View style={{ height }} onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={height} accessibilityLabel="API requests over time">
          <Defs>
            <LinearGradient id="requestsArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={DevColors.primary} stopOpacity="0.34" />
              <Stop offset="1" stopColor={DevColors.primary} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {[0, 0.5, 1].map((ratio) => {
            const y = padding.top + plotHeight * ratio;
            return (
              <Line
                key={ratio}
                x1={padding.left}
                y1={y}
                x2={padding.left + plotWidth}
                y2={y}
                stroke={DevColors.chartGrid}
                strokeWidth={1}
                strokeDasharray="3 5"
              />
            );
          })}

          {points.length > 1 ? <Path d={areaPath} fill="url(#requestsArea)" /> : null}
          {points.length > 1 ? (
            <Path
              d={linePath}
              fill="none"
              stroke={DevColors.primarySoft}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {points.map((point, index) =>
            data[index]?.requests > 0 ? (
              <Circle
                key={`dot-${index}`}
                cx={point.x}
                cy={point.y}
                r={data.length > 14 ? 1.8 : 2.6}
                fill={DevColors.primarySoft}
              />
            ) : null
          )}

          {labelIndices(data.length).map((index) => {
            const point = points[index];
            if (!point) return null;
            return (
              <SvgText
                key={`label-${index}`}
                x={point.x}
                y={height - 6}
                fill={DevColors.textMuted}
                fontSize={9}
                textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
              >
                {axisLabel(data[index]?.bucketStart || '', bucket)}
              </SvgText>
            );
          })}
        </Svg>
      ) : null}

      {total === 0 ? (
        <View style={styles.chartOverlay} pointerEvents="none">
          <Text style={styles.overlayTitle}>No requests in this range</Text>
          <Text style={styles.overlayHint}>Authenticated API calls will appear here.</Text>
        </View>
      ) : null}
    </View>
  );
}

export function SuccessFailureChart({
  data,
  bucket,
  height = 190,
}: SeriesChartProps) {
  const { width, onLayout } = useChartWidth();
  const total = data.reduce((sum, point) => sum + point.success + point.failed, 0);
  const max = Math.max(1, ...data.map((point) => point.success + point.failed));
  const padding = { top: 10, right: 6, bottom: 22, left: 6 };
  const plotWidth = Math.max(0, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;
  const baseline = padding.top + plotHeight;
  const groupWidth = data.length > 0 ? plotWidth / data.length : plotWidth;
  const barWidth = Math.max(2, Math.min(16, groupWidth * 0.58));

  return (
    <View style={{ height }} onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={height} accessibilityLabel="Successful versus failed requests">
          {[0, 0.5, 1].map((ratio) => {
            const y = padding.top + plotHeight * ratio;
            return (
              <Line
                key={ratio}
                x1={padding.left}
                y1={y}
                x2={padding.left + plotWidth}
                y2={y}
                stroke={DevColors.chartGrid}
                strokeWidth={1}
                strokeDasharray="3 5"
              />
            );
          })}

          {data.map((point, index) => {
            const x = padding.left + groupWidth * index + (groupWidth - barWidth) / 2;
            const successHeight = (point.success / max) * plotHeight;
            const failedHeight = (point.failed / max) * plotHeight;
            const successY = baseline - successHeight;
            const failedY = successY - failedHeight;
            return (
              <React.Fragment key={point.bucketStart}>
                {successHeight > 0 ? (
                  <Rect
                    x={x}
                    y={successY}
                    width={barWidth}
                    height={Math.max(1, successHeight)}
                    rx={2}
                    fill={DevColors.chartSuccess}
                    opacity={0.9}
                  />
                ) : null}
                {failedHeight > 0 ? (
                  <Rect
                    x={x}
                    y={failedY}
                    width={barWidth}
                    height={Math.max(1, failedHeight)}
                    rx={2}
                    fill={DevColors.chartFailed}
                    opacity={0.9}
                  />
                ) : null}
              </React.Fragment>
            );
          })}

          {labelIndices(data.length).map((index) => {
            const x = padding.left + groupWidth * index + groupWidth / 2;
            return (
              <SvgText
                key={`label-${index}`}
                x={x}
                y={height - 5}
                fill={DevColors.textMuted}
                fontSize={9}
                textAnchor="middle"
              >
                {axisLabel(data[index]?.bucketStart || '', bucket)}
              </SvgText>
            );
          })}
        </Svg>
      ) : null}

      {total === 0 ? (
        <View style={styles.chartOverlay} pointerEvents="none">
          <Text style={styles.overlayTitle}>No responses to compare yet</Text>
        </View>
      ) : null}
    </View>
  );
}

export function EndpointUsageBars({ data }: { data: DeveloperEndpointUsage[] }) {
  const max = Math.max(1, ...data.map((item) => item.requests));
  return (
    <View style={{ gap: DevSpacing.md }}>
      {data.map((item) => {
        const widthPercent = Math.max(4, (item.requests / max) * 100);
        const failedRatio = item.requests > 0 ? item.failed / item.requests : 0;
        return (
          <View key={item.endpoint} style={styles.endpointRow}>
            <View style={styles.endpointTop}>
              <Text style={styles.endpointName} numberOfLines={1}>
                {item.endpoint}
              </Text>
              <Text style={styles.endpointValue}>{item.requests}</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${widthPercent}%`,
                    backgroundColor:
                      failedRatio > 0.5 ? DevColors.chartFailed : DevColors.primary,
                  },
                ]}
              />
            </View>
            <View style={styles.endpointMeta}>
              <Text style={styles.endpointMetaText}>
                {item.success} success · {item.failed} failed
              </Text>
              <Text style={styles.endpointMetaText}>avg {Math.round(item.averageDurationMs)} ms</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function EnvironmentDonut({
  test,
  live,
  size = 164,
}: {
  test: number;
  live: number;
  size?: number;
}) {
  const total = test + live;
  const stroke = 15;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const testShare = total > 0 ? test / total : 0;
  const liveShare = total > 0 ? live / total : 0;

  return (
    <View style={{ alignItems: 'center', gap: DevSpacing.md }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={DevColors.chartGrid}
            strokeWidth={stroke}
            fill="none"
          />
          {liveShare > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={DevColors.primary}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${liveShare * circumference} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null}
          {testShare > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={DevColors.info}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${testShare * circumference} ${circumference}`}
              strokeDashoffset={-liveShare * circumference}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null}
        </Svg>
        <View style={styles.donutCenter}>
          <Text style={styles.donutValue}>{total}</Text>
          <Text style={styles.donutLabel}>requests</Text>
        </View>
      </View>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: DevColors.primary }]} />
          <Text style={styles.legendText}>Live · {live}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: DevColors.info }]} />
          <Text style={styles.legendText}>Test · {test}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  overlayTitle: { color: DevColors.textSecondary, fontSize: 12.5, fontWeight: '600' },
  overlayHint: { color: DevColors.textMuted, fontSize: 11 },
  endpointRow: { gap: 5 },
  endpointTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  endpointName: {
    color: DevColors.text,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
    flex: 1,
  },
  endpointValue: { color: DevColors.textSecondary, fontSize: 11.5, fontWeight: '700' },
  barTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: DevColors.backgroundAlt,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DevColors.border,
  },
  barFill: { height: '100%', borderRadius: 999 },
  endpointMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  endpointMetaText: { color: DevColors.textMuted, fontSize: 10.5 },
  donutCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutValue: { color: DevColors.text, fontSize: 24, fontWeight: '800' },
  donutLabel: { color: DevColors.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: DevSpacing.lg, flexWrap: 'wrap', justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: DevColors.textSecondary, fontSize: 11.5, fontWeight: '600' },
});
