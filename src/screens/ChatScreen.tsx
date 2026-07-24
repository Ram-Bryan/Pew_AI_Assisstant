import React from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useKeyboardController } from '@react-native/keyboard-controller';
import { MessageCircle, Send, Mic, MicOff } from 'lucide-react-native';
import { useChatStore } from '@/src/store/chatStore';
import { useModelsStore } from '@/src/store/modelsStore';

export default function ChatScreen() {
  const { messages, sendMessage, isLoading, clearChat } = useChatStore();
  const { selectedModel, models } = useModelsStore();
  const [text, setText] = React.useState('');
  const [showModelPicker, setShowModelPicker] = React.useState(false);
  const { height: keyboardHeight, animate } = useKeyboardController();

  const handleSend = () => {
    if (text.trim() && !isLoading) {
      sendMessage(text);
      setText('');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
      style={{ flex: 1, backgroundColor: '#F0FDF4' }}
    >
      <ScrollView
        className="flex-1 p-4"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-end">
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View
                className={`flex-1 mb-3 max-w-[80%] ${item.role === 'user' ? 'self-end' : 'self-start'}`}
              >
                <View
                  className={`px-4 py-3 rounded-2xl ${
                    item.role === 'user'
                      ? 'bg-green-500 text-white rounded-br-md'
                      : 'bg-white text-gray-900 shadow-sm rounded-bl-md border border-green-100'
                  }`}
                >
                  <Text className="text-base leading-relaxed">{item.content}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center">
                <MessageCircle className="text-green-300 text-6xl mb-4" />
                <Text className="text-gray-500 text-center px-8">
                  Start a conversation with {selectedModel?.name || 'your AI assistant'}
                </Text>
              </View>
            }
          />
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-green-100">
        <View className="flex-row items-end gap-2">
          <TouchableOpacity
            onPress={() => setShowModelPicker(true)}
            className="p-2 text-green-500"
            disabled={isLoading}
          >
            <Text className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
              {selectedModel?.name || 'Select Model'}
            </Text>
          </TouchableOpacity>

          <TextInput
            className="flex-1 bg-gray-50 border border-green-200 rounded-full px-4 py-3 pr-12 text-base"
            value={text}
            onChangeText={setText}
            onSubmitEditing={handleSend}
            placeholder="Message..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={4000}
          />

          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || isLoading}
            className={`p-3 rounded-full ${
              text.trim() && !isLoading ? 'bg-green-500' : 'bg-green-200'
            }`}
          >
            <Send className="text-white text-xl" />
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center justify-between mt-2 px-2">
          <TouchableOpacity className="p-2 text-gray-400">
            <Mic className="text-xl" />
          </TouchableOpacity>
          <TouchableOpacity className="p-2 text-gray-400">
            <MicOff className="text-xl" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}