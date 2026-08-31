import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { theme } from './theme';

type Props = ViewProps & {
  from?: string;
  to?: string;
  angle?: 'diagonal' | 'vertical';
};

export function GradientBackground({ from = theme.colors.primary, to = theme.colors.primaryDark, angle = 'diagonal', style, children, ...rest }: Props) {
  const x2 = angle === 'diagonal' ? '100%' : '0%';
  return (
    <View style={[styles.container, style]} {...rest}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="grad" x1="0%" y1="0%" x2={x2} y2="100%">
            <Stop offset="0%" stopColor={from} stopOpacity={1} />
            <Stop offset="100%" stopColor={to} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#grad)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
});
