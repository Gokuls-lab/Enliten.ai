import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import {
  X,
  FileText,
  Upload,
  History,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { API_BASE_URL, getAccessToken } from '@/lib/api';

const { width, height } = Dimensions.get('window');

interface EvaluateMainModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function EvaluateMainModal({ visible, onClose }: EvaluateMainModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [questionText, setQuestionText] = useState('');
  const [totalMarks, setTotalMarks] = useState<number | null>(null);
  const [customMarks, setCustomMarks] = useState('');
  const [activeMarksType, setActiveMarksType] = useState<'preset' | 'custom' | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; size: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const modalHeight = useSharedValue(0);
  const animatedModalStyle = useAnimatedStyle(() => ({
    height: modalHeight.value,
  }));

  useEffect(() => {
    if (visible) {
      modalHeight.value = withTiming(height * 0.75, { duration: 300 });
    } else {
      modalHeight.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const handleSelectMarks = (value: number | 'custom') => {
    if (value === 'custom') {
      setActiveMarksType('custom');
      setTotalMarks(null);
    } else {
      setActiveMarksType('preset');
      setTotalMarks(value);
      setCustomMarks('');
    }
  };

  useEffect(() => {
    if (activeMarksType === 'custom' && customMarks) {
      const num = parseInt(customMarks, 10);
      if (!isNaN(num) && num > 0) {
        setTotalMarks(num);
      } else {
        setTotalMarks(null);
      }
    }
  }, [customMarks, activeMarksType]);

  const handlePickFile = async () => {
    try {
      const DocumentPicker = require('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        multiple: false,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const fileSizeMB = (asset.size || 0) / (1024 * 1024);
        if (fileSizeMB > 50) {
          Alert.alert('File too large', `This file is ${fileSizeMB.toFixed(2)} MB. Maximum allowed is 50 MB.`);
          return;
        }
        setSelectedFile({
          uri: asset.uri,
          name: asset.name || `file_${Date.now()}.pdf`,
          size: asset.size || 0,
        });
        setUploadProgress(0);
      }
    } catch (err: any) {
      console.error('Document picker error:', err);
      Alert.alert('Error', 'Failed to open file picker');
    }
  };

  const handleUploadAndEvaluate = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setUploadProgress(10);

    let evaluationId: string | null = null;

    try {
      const response = await fetch(selectedFile.uri);
      const fileData = await response.arrayBuffer();
      setUploadProgress(30);

      const timestamp = Date.now();
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${user.id}/${timestamp}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(storagePath, fileData, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      setUploadProgress(60);

      const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(storagePath);
      const publicUrl = urlData.publicUrl;
      setUploadProgress(80);

      const { data: evalRow, error: evalError } = await supabase
        .from('main_evaluations')
        .insert({
          user_id: user.id,
          status: 'processing',
          question_text: questionText.trim() || null,
          file_name: selectedFile.name,
          file_url: publicUrl,
          storage_path: storagePath,
        })
        .select('*')
        .single();

      if (evalError) throw new Error(`DB insert failed: ${evalError.message}`);
      evaluationId = evalRow.id;
      setUploadProgress(100);
      setIsUploading(false);
      setIsEvaluating(true);

      const token = await getAccessToken();
      const evalResponse = await fetch(`${API_BASE_URL}/api/evaluate-main`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          evaluation_id: evalRow.id,
          file_url: publicUrl,
          file_name: selectedFile.name,
          question_text: questionText.trim() || undefined,
          total_marks: totalMarks,
          subject_name: subjectName.trim() || undefined,
        }),
      });

      const evalResult = await evalResponse.json();

      // Whether success or fail, navigate to history screen to show status
      handleClose();
      router.push({
        pathname: '/evaluate-history',
        params: { evaluation_id: evaluationId },
      });
    } catch (err: any) {
      console.error('Upload/Evaluate error:', err);
      setIsUploading(false);
      setIsEvaluating(false);
      // Even on error, if we created a DB row, navigate to history to show failed status
      if (evaluationId) {
        handleClose();
        router.push({
          pathname: '/evaluate-history',
          params: { evaluation_id: evaluationId },
        });
      } else {
        Alert.alert('Error', err.message || 'Failed to evaluate answer sheet');
      }
    }
  };

  const handleOpenHistory = () => {
    handleClose();
    router.push('/evaluate-history');
  };

  const handleClose = () => {
    setSelectedFile(null);
    setQuestionText('');
    setTotalMarks(null);
    setCustomMarks('');
    setActiveMarksType(null);
    setSubjectName('');
    setUploadProgress(0);
    setIsUploading(false);
    setIsEvaluating(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Animated.View style={[styles.modalContainer, animatedModalStyle, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Evaluate Mains</Text>
            <View style={styles.modalHeaderRight}>
              <TouchableOpacity onPress={handleOpenHistory} style={styles.iconButton}>
                <History size={22} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose} style={styles.iconButton}>
                <X size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text }]}>Question (Optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter question text (skip if in PDF)"
                placeholderTextColor={colors.subText}
                value={questionText}
                onChangeText={setQuestionText}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text }]}>Total Marks (Optional)</Text>
              <View style={styles.marksTiles}>
                {[10, 15, 20].map((marks) => (
                  <TouchableOpacity
                    key={marks}
                    onPress={() => handleSelectMarks(marks)}
                    style={[
                      styles.marksTile,
                      activeMarksType === 'preset' && totalMarks === marks
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.inputBg, borderColor: colors.border },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.marksTileText,
                        { color: activeMarksType === 'preset' && totalMarks === marks ? '#FFFFFF' : colors.text },
                      ]}
                    >
                      {marks}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => handleSelectMarks('custom')}
                  style={[
                    styles.marksTile,
                    activeMarksType === 'custom'
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.inputBg, borderColor: colors.border },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.marksTileText,
                      { color: activeMarksType === 'custom' ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    Custom
                  </Text>
                </TouchableOpacity>
              </View>
              {activeMarksType === 'custom' && (
                <TextInput
                  style={[styles.customMarksInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="Enter marks"
                  placeholderTextColor={colors.subText}
                  value={customMarks}
                  onChangeText={setCustomMarks}
                  keyboardType="numeric"
                />
              )}
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text }]}>Subject Name (Optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, minHeight: 50 }]}
                placeholder="e.g. Indian Polity, History, Geography..."
                placeholderTextColor={colors.subText}
                value={subjectName}
                onChangeText={setSubjectName}
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text }]}>Answer Sheet PDF</Text>
              <TouchableOpacity
                style={[styles.dropZone, { borderColor: selectedFile ? colors.primary : colors.border, backgroundColor: selectedFile ? colors.primarySoft : colors.inputBg }]}
                onPress={handlePickFile}
                activeOpacity={0.7}
              >
                {selectedFile ? (
                  <View style={styles.fileSelected}>
                    <FileText size={32} color={colors.primary} />
                    <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                      {selectedFile.name}
                    </Text>
                    <Text style={[styles.fileSize, { color: colors.subText }]}>
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </Text>
                  </View>
                ) : (
                  <View style={styles.dropZoneContent}>
                    <Upload size={40} color={colors.subText} />
                    <Text style={[styles.dropText, { color: colors.text }]}>Tap to select PDF</Text>
                    <Text style={[styles.dropSubtext, { color: colors.subText }]}>or drag and drop</Text>
                    <Text style={[styles.maxSizeText, { color: colors.subText }]}>Max 50 MB per file</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {(isUploading || isEvaluating) && (
              <View style={styles.progressSection}>
                <View style={styles.progressBar}>
                  <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    style={[styles.progressFill, { width: `${uploadProgress}%` }]}
                  />
                </View>
                <Text style={[styles.progressText, { color: colors.subText }]}>
                  {isUploading ? `Uploading... ${uploadProgress}%` : 'Evaluating with AI...'}
                </Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.evaluateButton, { marginBottom: insets.bottom + 16, backgroundColor: selectedFile && !isUploading && !isEvaluating ? colors.primary : colors.border }]}
            onPress={handleUploadAndEvaluate}
            disabled={!selectedFile || isUploading || isEvaluating}
            activeOpacity={0.8}
          >
            <Text style={[styles.evaluateButtonText, { color: selectedFile && !isUploading && !isEvaluating ? '#FFFFFF' : colors.subText }]}>
              {isUploading ? 'Uploading...' : isEvaluating ? 'Evaluating...' : 'Evaluate'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
  },
  dropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  dropZoneContent: {
    alignItems: 'center',
  },
  dropText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  dropSubtext: {
    fontSize: 13,
    marginTop: 4,
  },
  maxSizeText: {
    fontSize: 11,
    marginTop: 8,
  },
  fileSelected: {
    alignItems: 'center',
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
    maxWidth: width - 100,
  },
  fileSize: {
    fontSize: 13,
    marginTop: 4,
  },
  progressSection: {
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(128,128,128,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    textAlign: 'center',
  },
  evaluateButton: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  evaluateButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  marksTiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  marksTile: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 64,
    alignItems: 'center',
  },
  marksTileText: {
    fontSize: 15,
    fontWeight: '600',
  },
  customMarksInput: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
});