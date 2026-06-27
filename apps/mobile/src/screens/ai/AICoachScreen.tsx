import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useAuthStore } from '../../stores/authStore';
import { useDiaryStore } from '../../stores/diaryStore';
import { db } from '../../services/supabase';
import { streamChatMessage } from '../../services/ai';
import { AIMessage } from '../../types';
import { format } from 'date-fns';

const QUICK_PROMPTS = [
  "What should I eat to hit my protein goal today?",
  "I'm on semaglutide and feel nauseated — what can I eat?",
  "Give me a high-protein breakfast under 400 calories",
  "Analyze my food diary and tell me what I'm missing",
  "What's a good meal prep strategy for this week?",
  "I only have eggs, spinach, and Greek yogurt — what can I make?",
];

export default function AICoachScreen() {
  const { session, profile } = useAuthStore();
  const { summary } = useDiaryStore();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    loadOrCreateConversation();
  }, []);

  const loadOrCreateConversation = async () => {
    if (!session?.user.id) return;

    // Get most recent conversation
    const { data: conv } = await db.aiConversations()
      .select('id')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (conv) {
      setConversationId(conv.id);
      const { data: msgs } = await db.aiMessages()
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at');
      setMessages((msgs ?? []) as AIMessage[]);
    } else {
      // Create new conversation
      const { data: newConv } = await db.aiConversations()
        .insert({ user_id: session.user.id, title: 'Nutrition Chat' })
        .select()
        .single();
      if (newConv) setConversationId(newConv.id);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming || !session?.user.id || !conversationId) return;

    const userMessage: AIMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    // Save user message
    await db.aiMessages().insert({
      conversation_id: conversationId,
      role: 'user',
      content: text.trim(),
    });

    // Streaming assistant response
    const assistantMessage: AIMessage = {
      id: `streaming-${Date.now()}`,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: text.trim() });

      let fullContent = '';

      for await (const chunk of streamChatMessage(
        history,
        profile!,
        summary,
        session.access_token
      )) {
        fullContent += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id ? { ...m, content: fullContent } : m
          )
        );
        listRef.current?.scrollToEnd({ animated: false });
      }

      // Save assistant message
      const { data: saved } = await db.aiMessages()
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: fullContent,
        })
        .select()
        .single();

      // Update with real ID
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMessage.id ? { ...m, id: saved?.id ?? m.id } : m))
      );

      // Update conversation timestamp
      await db.aiConversations()
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, content: "I'm having trouble connecting right now. Please try again." }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const renderMessage = ({ item }: { item: AIMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <LinearGradient colors={['#1A6B3C', '#27A85F']} style={styles.aiAvatarGrad}>
              <Ionicons name="sparkles" size={14} color="#fff" />
            </LinearGradient>
          </View>
        )}
        <View style={[styles.messageContent, isUser ? styles.userContent : styles.aiContent]}>
          {item.content ? (
            <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
              {item.content}
            </Text>
          ) : (
            <View style={styles.typingIndicator}>
              <LoadingDots />
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.coachInfo}>
            <LinearGradient colors={['#1A6B3C', '#27A85F']} style={styles.coachAvatar}>
              <Ionicons name="sparkles" size={20} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.coachName}>Nouri Coach</Text>
              <Text style={styles.coachStatus}>
                {isStreaming ? 'Typing...' : 'AI Nutrition Assistant'}
              </Text>
            </View>
          </View>
          <TouchableOpacity>
            <Ionicons name="ellipsis-horizontal" size={22} color="#555" />
          </TouchableOpacity>
        </View>

        {/* Today's context banner */}
        {summary && (
          <View style={styles.contextBanner}>
            <Text style={styles.contextText}>
              Today: {summary.total_calories.toFixed(0)} kcal eaten •{' '}
              {summary.total_protein_g.toFixed(0)}g protein •{' '}
              {(profile?.daily_calories_target ?? 2000) - summary.total_calories > 0
                ? `${((profile?.daily_calories_target ?? 2000) - summary.total_calories).toFixed(0)} kcal remaining`
                : 'Goal met! 🎉'}
            </Text>
          </View>
        )}

        {/* Messages */}
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <LinearGradient colors={['#1A6B3C', '#27A85F']} style={styles.emptyAvatar}>
              <Ionicons name="sparkles" size={36} color="#fff" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Hi, I'm your Nouri Coach</Text>
            <Text style={styles.emptySubtitle}>
              Ask me anything about nutrition, your meals, recipes, or your{' '}
              {profile?.is_glp1_user ? 'GLP-1 journey' : 'health goals'}.
            </Text>
            <View style={styles.quickPromptsGrid}>
              {QUICK_PROMPTS.map((prompt, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.quickPrompt}
                  onPress={() => sendMessage(prompt)}
                >
                  <Text style={styles.quickPromptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(m) => m.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about nutrition, meals, recipes..."
            placeholderTextColor="#AAA"
            multiline
            maxLength={500}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || isStreaming) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
          >
            <Ionicons
              name={isStreaming ? 'stop-circle' : 'arrow-up'}
              size={20}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LoadingDots() {
  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 4 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#999' }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  coachInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coachAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  coachName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  coachStatus: { fontSize: 12, color: '#999', marginTop: 1 },
  contextBanner: {
    backgroundColor: '#F0FBF5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#D4EFD8',
  },
  contextText: { fontSize: 12, color: '#1A6B3C', fontWeight: '500' },
  emptyState: { flex: 1, alignItems: 'center', padding: 24, paddingTop: 40 },
  emptyAvatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginBottom: 8 },
  emptySubtitle: {
    fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24,
  },
  quickPromptsGrid: { width: '100%', gap: 8 },
  quickPrompt: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  quickPromptText: { fontSize: 13, color: '#444', lineHeight: 18 },
  messageList: { padding: 16, gap: 12 },
  messageBubble: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  userBubble: { justifyContent: 'flex-end' },
  aiBubble: { justifyContent: 'flex-start' },
  aiAvatar: { width: 28, height: 28, marginBottom: 4 },
  aiAvatarGrad: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  messageContent: { maxWidth: '80%', borderRadius: 16, padding: 12 },
  userContent: { backgroundColor: '#1A6B3C', borderBottomRightRadius: 4 },
  aiContent: { backgroundColor: '#F5F5F5', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#fff' },
  aiText: { color: '#1A1A1A' },
  typingIndicator: { paddingHorizontal: 4 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    color: '#1A1A1A',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1A6B3C',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#C8E6C9' },
});
