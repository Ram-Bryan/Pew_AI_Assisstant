import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';
import { AppToggle } from '../../src/domains/apps/components/AppToggle';
import { CredentialModal } from '../../src/domains/apps/components/CredentialModal';
import { SEED_APPS } from '../../src/constants/apps';
import { useAppsList, useConnectOAuth } from '../../src/domains/apps/hooks';
import { showToast } from '../../src/services/toast';

function ConnectOAuthButton({ appId }: { appId: number }) {
  const connect = useConnectOAuth();
  const handleConnect = async () => {
    try {
      await connect.mutateAsync({ appId });
      showToast('Connected');
    } catch {}
  };
  return (
    <View>
      <Pressable
        className="mt-6 rounded-xl bg-primary py-3"
        onPress={handleConnect}
        disabled={connect.isPending}
      >
        <Text className="text-center font-semibold text-white">
          {connect.isPending ? 'Connecting…' : 'Connect'}
        </Text>
      </Pressable>
      {connect.isError ? (
        <Text className="mt-2 text-center text-sm text-red-500">
          Could not connect. Try again.
        </Text>
      ) : null}
    </View>
  );
}

export default function AppDetailScreen() {
  const { appsId } = useLocalSearchParams<{ appsId: string }>();
  const id = Number(appsId);
  const { data } = useAppsList();
  const app = data?.find((a) => a.id === id);
  const meta = SEED_APPS.find((a) => a.id === id);
  const [modalOpen, setModalOpen] = useState(false);

  if (!app || !meta) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">App not found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white p-4">
      <Text className="text-2xl font-bold text-gray-900">{app.name}</Text>
      <Text className="mt-1 text-gray-500">{app.description}</Text>
      {meta.helpUrl ? (
        <Pressable onPress={() => Linking.openURL(meta.helpUrl)}>
          <Text className="mt-2 font-medium text-accent">How to enable this?</Text>
        </Pressable>
      ) : null}
      <AppToggle app={app} />
      {app.auth_type === 'oauth' ? <ConnectOAuthButton appId={app.id} /> : null}
      {app.auth_type === 'api_key' ? (
        <Pressable
          className="mt-6 rounded-xl bg-primary py-3"
          onPress={() => setModalOpen(true)}
        >
          <Text className="text-center font-semibold text-white">Connect</Text>
        </Pressable>
      ) : null}
      <CredentialModal appId={app.id} open={modalOpen} onClose={() => setModalOpen(false)} />
    </View>
  );
}
