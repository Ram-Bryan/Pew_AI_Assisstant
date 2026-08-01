import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useConnectApiKey } from '../hooks';
import { showToast } from '../../../services/toast';

export function CredentialModal({
  appId,
  open,
  onClose,
}: {
  appId: number;
  open: boolean;
  onClose: () => void;
}) {
  const connect = useConnectApiKey();
  const [apiKey, setApiKey] = useState('');

  const handleConnect = async () => {
    try {
      await connect.mutateAsync({ appId, apiKey });
      setApiKey('');
      onClose();
      showToast('Connected');
    } catch (err) {
      setApiKey('');
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/40">
        <View className="w-4/5 rounded-2xl bg-white p-6">
          <Text className="text-lg font-semibold text-gray-900">Enter API key</Text>
          <TextInput
            className="mt-4 rounded-xl border border-gray-200 px-4 py-3 text-gray-900"
            placeholder="sk-..."
            placeholderTextColor="#9CA3AF"
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          {connect.isError ? (
            <Text className="mt-2 text-sm text-red-500">
              Verify your credentials and try again.
            </Text>
          ) : null}
          <View className="mt-6 flex-row justify-end gap-3">
            <Pressable onPress={onClose} disabled={connect.isPending}>
              <Text className="px-4 py-2 text-gray-500">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConnect}
              disabled={connect.isPending || apiKey.trim().length === 0}
              className="rounded-xl bg-primary px-5 py-2"
            >
              {connect.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-semibold text-white">Connect</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
