import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { theme } from './theme';

type Props = ViewProps & {
  from?: string;
  to?: string;
  angle?: 'diagonal' | 'vertical';
  curvedBottom?: boolean;
  /** Profundidade da curva, em % da altura total (0-100). */
  curveDepth?: number;
};

export function GradientBackground({
  from = theme.colors.primary,
  to = theme.colors.primaryDark,
  angle = 'diagonal',
  curvedBottom = false,
  curveDepth = 8,
  style,
  children,
  ...rest
}: Props) {
  const x2 = angle === 'diagonal' ? '100%' : '0%';
  const sideY = 100 - curveDepth;
  const peakY = 100 + curveDepth;

  return (
    <View style={[styles.container, style]} {...rest}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="grad" x1="0%" y1="0%" x2={x2} y2="100%">
              <Stop offset="0%" stopColor={from} stopOpacity={1} />
              <Stop offset="100%" stopColor={to} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          {curvedBottom ? (
            <Path d={`M0,0 L100,0 L100,${sideY} Q50,${peakY} 0,${sideY} Z`} fill="url(#grad)" />
          ) : (
            <Rect x={0} y={0} width={100} height={100} fill="url(#grad)" />
          )}
        </Svg>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
});
