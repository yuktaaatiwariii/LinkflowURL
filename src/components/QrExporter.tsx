import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  QR_DARK,
  QR_EXPORT_SIZE,
  QR_LIGHT,
  svgToBase64Png,
  waitForRender,
} from '../utils/qrExport';

export interface QrExporterHandle {
  /** Renders `value` into a high-resolution PNG and resolves its base64 data. */
  exportPng(value: string): Promise<string>;
}

/**
 * Off-screen, high-resolution QR renderer used only for exporting/sharing.
 * Keeping it out of the visible layout guarantees that the exported PNG is the
 * exact same QR pattern that is displayed to the user.
 */
export const QrExporter = forwardRef<QrExporterHandle>(function QrExporter(_props, ref) {
  const svgRef = useRef<any>(null);
  const [value, setValue] = useState('https://linkflow.local');

  useImperativeHandle(
    ref,
    () => ({
      async exportPng(nextValue: string) {
        if (!nextValue) {
          throw new Error('No QR content to export.');
        }
        setValue(nextValue);
        await waitForRender();
        return svgToBase64Png(svgRef.current);
      },
    }),
    []
  );

  return (
    <View style={styles.offscreen} pointerEvents="none">
      <QRCode
        getRef={(component: any) => {
          svgRef.current = component;
        }}
        value={value}
        size={QR_EXPORT_SIZE}
        color={QR_DARK}
        backgroundColor={QR_LIGHT}
        quietZone={20}
        ecl="M"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    left: -10000,
    top: 0,
    width: QR_EXPORT_SIZE,
    height: QR_EXPORT_SIZE,
    opacity: 0.01,
  },
});
