import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useDeviceRole } from './src/setup/useDeviceRole';
import { SetupScreen } from './src/setup/SetupScreen';
import { BroadcasterScreen } from './src/broadcaster/BroadcasterScreen';
import { ViewerScreen } from './src/viewer/ViewerScreen';

export default function App() {
  const { role, chooseRole, resetRole } = useDeviceRole();

  return (
    <>
      <StatusBar style="light" />
      {renderContent()}
    </>
  );

  function renderContent() {
    if (role === undefined) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      );
    }
    if (role === null) return <SetupScreen onChoose={chooseRole} />;
    return role === 'broadcaster' ? (
      <BroadcasterScreen onChangeRole={resetRole} />
    ) : (
      <ViewerScreen onChangeRole={resetRole} />
    );
  }
}
