import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StatusBar, Modal, ScrollView } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { initDB, getDB } from './database';
import * as WebBrowser from 'expo-web-browser';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';

// ----------------- 1. AI 聊天主界面 (UI 修复版) -----------------
function ChatScreen({ navigation }) {
  const [messages, setMessages] = useState({});
  const [currentNodeId, setCurrentNodeId] = useState('root');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const savedMsgs = await AsyncStorage.getItem('@chat_tree');
      const savedNode = await AsyncStorage.getItem('@current_node');
      if (savedMsgs) setMessages(JSON.parse(savedMsgs));
      if (savedNode) setCurrentNodeId(savedNode);
    } catch (e) { console.error("记忆读取失败", e); }
  };

  const saveHistory = async (newMsgs, newNodeId) => {
    await AsyncStorage.setItem('@chat_tree', JSON.stringify(newMsgs));
    await AsyncStorage.setItem('@current_node', newNodeId);
  };

  const getCurrentTimeline = () => {
    const timeline = [];
    let currId = currentNodeId;
    while (currId && currId !== 'root' && messages[currId]) {
      timeline.unshift(messages[currId]);
      currId = messages[currId].parentId;
    }
    return timeline;
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    const userMsgId = Date.now().toString();
    const userMsg = { id: userMsgId, parentId: currentNodeId, role: 'user', content: inputText, timestamp: new Date().toLocaleTimeString() };
    const newMsgs = { ...messages, [userMsgId]: userMsg };
    setMessages(newMsgs); setCurrentNodeId(userMsgId); setInputText(''); setIsLoading(true);

    try {
      const timelineMsgs = getCurrentTimeline().concat(userMsg).map(m => ({ role: m.role, content: m.content }));
      const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: timelineMsgs, temperature: 0.7 })
      });
      const data = await response.json();
      const aiReplyText = data.choices[0].message.content;
      const aiMsgId = (Date.now() + 1).toString();
      const aiMsg = { id: aiMsgId, parentId: userMsgId, role: 'assistant', content: aiReplyText, timestamp: new Date().toLocaleTimeString() };
      const finalMsgs = { ...newMsgs, [aiMsgId]: aiMsg };
      setMessages(finalMsgs); setCurrentNodeId(aiMsgId); saveHistory(finalMsgs, aiMsgId);
    } catch (error) {
      Alert.alert("连接失败", "AI没开机，或者网络被拦截！\n" + error.message);
      saveHistory(newMsgs, userMsgId);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} keyboardVerticalOffset={0} style={{ flex: 1, backgroundColor: '#121212' }}>
      {/* 唯一正确的完美状态栏 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingBottom: 15, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 45, backgroundColor: '#1A1A1A', borderBottomWidth: 1, borderBottomColor: '#333' }}>
        <TouchableOpacity onPress={() => navigation.openDrawer()}><Ionicons name="menu" size={28} color="#00FF00" /></TouchableOpacity>
        <Text style={{ color: '#00FF00', fontWeight: 'bold', fontSize: 18 }}>🧠 Qwen Local (1.5B)</Text>
        <TouchableOpacity onPress={() => { setMessages({}); setCurrentNodeId('root'); AsyncStorage.clear(); }}><Ionicons name="trash-outline" size={24} color="#FF4444" /></TouchableOpacity>
      </View>

      <FlatList
        data={getCurrentTimeline()}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 15 }}
        renderItem={({ item }) => (
          <View style={{ alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', marginBottom: 15, backgroundColor: item.role === 'user' ? '#00FF00' : '#2A2A2A', padding: 12, borderRadius: 16 }}>
            <Text style={{ color: item.role === 'user' ? '#000' : '#FFF', fontSize: 16 }}>{item.content}</Text>
          </View>
        )}
      />

      <View style={{ flexDirection: 'row', padding: 15, backgroundColor: '#1E1E1E', paddingBottom: 25 }}>
        <TextInput style={{ flex: 1, backgroundColor: '#000', color: '#FFF', padding: 12, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#333' }} placeholder="向本地干问输入..." placeholderTextColor="#666" value={inputText} onChangeText={setInputText} multiline />
        <TouchableOpacity onPress={sendMessage} disabled={isLoading} style={{ justifyContent: 'center', alignItems: 'center', backgroundColor: isLoading ? '#333' : '#00FF00', width: 50, height: 50, borderRadius: 25, alignSelf: 'flex-end' }}>
          {isLoading ? <ActivityIndicator color="#000" /> : <Ionicons name="send" size={20} color="#000" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ----------------- 2. 抽屉导航器 (左侧边栏) -----------------
const Drawer = createDrawerNavigator();
function ChatDrawer() {
  return (
    <Drawer.Navigator screenOptions={{ headerShown: false, drawerStyle: { backgroundColor: '#1E1E1E', width: 280 }, drawerActiveTintColor: '#000', drawerActiveBackgroundColor: '#00FF00', drawerInactiveTintColor: '#FFF' }}>
      <Drawer.Screen name="CurrentChat" component={ChatScreen} options={{ title: '💬 当前会话' }} />
      <Drawer.Screen name="HistoryPlaceholder" component={ChatScreen} options={{ title: '📂 历史记忆' }} />
    </Drawer.Navigator>
  );
}

// ----------------- 3. 闪卡锻造与卡片库 (Anki 2.0) -----------------
function DocumentScreen() {
  const [aiText, setAiText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [manualFront, setManualFront] = useState('');
  const [manualBack, setManualBack] = useState('');
  const [category, setCategory] = useState('默认'); // 新增分类功能

  const [showLibrary, setShowLibrary] = useState(false);
  const [savedCards, setSavedCards] = useState([]);

  // 刷新卡片库
  const loadCards = () => {
    try {
      const db = getDB();
      // 使用最新的 expo-sqlite 同步 API 读取所有卡片
      const allRows = db.getAllSync('SELECT * FROM flashcards ORDER BY id DESC');
      setSavedCards(allRows);
    } catch (e) { console.log("读取卡片失败", e); }
  };

  // 存入 SQLite
  const saveCardToDB = () => {
    if (!manualFront || !manualBack) {
      Alert.alert("错误", "正面和背面不能为空！");
      return;
    }
    try {
      const db = getDB();
      db.runSync(`INSERT INTO flashcards (front, back, doc_id) VALUES (?, ?, ?)`, [manualFront, manualBack, category]);
      Alert.alert("成功", `闪卡已存入 [${category}] 分类！`);
      setManualFront(''); setManualBack('');
    } catch (e) { Alert.alert("存储失败", e.message); }
  };

  // 删除卡片
  const deleteCard = (id) => {
    try {
      const db = getDB();
      db.runSync(`DELETE FROM flashcards WHERE id = ?`, [id]);
      loadCards(); // 刷新列表
    } catch (e) { Alert.alert("删除失败", e.message); }
  };

  const generateCardsWithAI = async () => {
    if (!aiText.trim()) return;
    setIsGenerating(true);
    try {
      const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: '你是一个无情的知识提取机器。提取核心知识点，严格返回纯JSON数组：[{"front": "问题", "back": "答案"}]。不要任何其他废话。' },
            { role: 'user', content: aiText }
          ], temperature: 0.1
        })
      });
      const data = await response.json();
      let cleanJsonStr = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const cards = JSON.parse(cleanJsonStr);
      if (cards && cards.length > 0) {
        setManualFront(cards[0].front); setManualBack(cards[0].back); setAiText('');
      }
    } catch (error) { Alert.alert("提取失败", error.message); } finally { setIsGenerating(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#121212', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 45 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 }}>
        <Text style={{ color: '#00FF00', fontSize: 24, fontWeight: 'bold' }}>📚 知识锻造炉</Text>
        <TouchableOpacity onPress={() => { loadCards(); setShowLibrary(true); }} style={{ backgroundColor: '#1E1E1E', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#00FF00' }}>
          <Text style={{ color: '#00FF00', fontWeight: 'bold' }}>🗂️ 查看卡片库</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {/* AI 提取区 */}
        <View style={{ backgroundColor: '#1A1A1A', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#333' }}>
          <Text style={{ color: '#FFF', fontSize: 16, marginBottom: 10 }}>🤖 将生涩文本丢给 AI 提炼闪卡：</Text>
          <TextInput style={{ backgroundColor: '#000', color: '#FFF', padding: 12, borderRadius: 8, height: 100, textAlignVertical: 'top' }} placeholder="粘贴阅读材料..." placeholderTextColor="#666" multiline value={aiText} onChangeText={setAiText} />
          <TouchableOpacity onPress={generateCardsWithAI} disabled={isGenerating} style={{ backgroundColor: isGenerating ? '#555' : '#00FF00', padding: 12, borderRadius: 8, marginTop: 10, alignItems: 'center' }}>
            {isGenerating ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>✨ 一键提取 JSON 闪卡</Text>}
          </TouchableOpacity>
        </View>

        {/* 手动微调与分类入库区 */}
        <View style={{ backgroundColor: '#1A1A1A', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333' }}>
          <Text style={{ color: '#FFF', fontSize: 16, marginBottom: 10 }}>✍️ 闪卡微调与入库：</Text>
          <View style={{ flexDirection: 'row', marginBottom: 10 }}>
            <Text style={{ color: '#888', alignSelf: 'center', marginRight: 10 }}>分类标签:</Text>
            <TextInput style={{ flex: 1, backgroundColor: '#000', color: '#00FF00', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#333' }} value={category} onChangeText={setCategory} />
          </View>
          <TextInput style={{ backgroundColor: '#000', color: '#FFF', padding: 12, borderRadius: 8, marginBottom: 10 }} placeholder="正面 (问题)" placeholderTextColor="#666" value={manualFront} onChangeText={setManualFront} />
          <TextInput style={{ backgroundColor: '#000', color: '#FFF', padding: 12, borderRadius: 8, marginBottom: 10, height: 80, textAlignVertical: 'top' }} placeholder="背面 (答案)" placeholderTextColor="#666" multiline value={manualBack} onChangeText={setManualBack} />
          <TouchableOpacity onPress={saveCardToDB} style={{ backgroundColor: '#1E1E1E', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#00FF00' }}>
            <Text style={{ color: '#00FF00', fontWeight: 'bold', fontSize: 16 }}>💾 注入海马体 (存入 SQLite)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 模态框：卡片库浏览与删除 */}
      <Modal visible={showLibrary} animationType="slide" transparent={true} onRequestClose={() => setShowLibrary(false)}>
        <View style={{ flex: 1, backgroundColor: '#121212', marginTop: 50, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, elevation: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold' }}>🗂️ 我的记忆库</Text>
            <TouchableOpacity onPress={() => setShowLibrary(false)}><Ionicons name="close-circle" size={30} color="#FF4444" /></TouchableOpacity>
          </View>
          <FlatList
            data={savedCards}
            keyExtractor={item => item.id.toString()}
            ListEmptyComponent={<Text style={{ color: '#666', textAlign: 'center', marginTop: 50 }}>你的海马体空空如也...</Text>}
            renderItem={({ item }) => (
              <View style={{ backgroundColor: '#1A1A1A', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#333' }}>
                <Text style={{ color: '#00FF00', fontSize: 12, marginBottom: 5 }}>🏷️ {item.doc_id || '默认'}</Text>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 5 }}>Q: {item.front}</Text>
                <Text style={{ color: '#AAA', fontSize: 14 }}>A: {item.back}</Text>
                <TouchableOpacity onPress={() => deleteCard(item.id)} style={{ position: 'absolute', right: 10, top: 10 }}>
                  <Ionicons name="trash" size={20} color="#FF4444" />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

// ----------------- 4. 全能书签与播客管理器 (支持自定义分类) -----------------
function BlogScreen() {
  const [bookmarks, setBookmarks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');

  // App 启动时读取本地书签库
  useEffect(() => {
    AsyncStorage.getItem('@my_bookmarks').then(data => {
      if (data) setBookmarks(JSON.parse(data));
    });
  }, []);

  // 保存新书签
  const saveBookmark = () => {
    if (!newTitle.trim() || !newUrl.trim()) {
      Alert.alert("提示", "标题和链接不能为空！");
      return;
    }
    const category = newCategory.trim() || '未分类'; // 如果不填分类，默认放入“未分类”

    const newBookmark = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      url: newUrl.trim(),
      category: category,
    };

    const updatedBookmarks = [newBookmark, ...bookmarks];
    setBookmarks(updatedBookmarks);
    AsyncStorage.setItem('@my_bookmarks', JSON.stringify(updatedBookmarks));

    // 清空输入框，但保留当前分类，方便连续录入同一类的链接
    setNewTitle('');
    setNewUrl('');
    Alert.alert("✨ 保存成功", `已加入 [${category}] 收藏单`);
  };

  // 删除书签
  const deleteBookmark = (id) => {
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated);
    AsyncStorage.setItem('@my_bookmarks', JSON.stringify(updated));
  };

  // 极客内置浏览器，直接在 App 内拉起 Web 视图
  const openLink = async (url) => {
    let finalUrl = url.toLowerCase().startsWith('http') ? url : `https://${url}`;
    await WebBrowser.openBrowserAsync(finalUrl, {
      presentationStyle: 'formSheet', // iOS 上的卡片式弹出
      toolbarColor: '#121212',        // 匹配暗色主题
      controlsColor: '#00FF00'
    });
  };

  // 动态提取当前所有存在的分类（用于生成顶部的过滤按钮）
  const categories = ['全部', ...new Set(bookmarks.map(b => b.category))];

  // 根据当前选中的分类过滤列表
  const displayList = activeCategory === '全部'
    ? bookmarks
    : bookmarks.filter(b => b.category === activeCategory);

  return (
    <View style={{ flex: 1, backgroundColor: '#121212', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 45 }}>
      <Text style={{ color: '#00FF00', fontSize: 24, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 15 }}>🔗 知识连接站</Text>

      {/* 📥 录入区 */}
      <View style={{ paddingHorizontal: 20, marginBottom: 15 }}>
        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
          <TextInput style={{ flex: 1, backgroundColor: '#1A1A1A', color: '#FFF', padding: 12, borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: '#333' }} placeholder="书签名称 (如: 极客周刊)" placeholderTextColor="#666" value={newTitle} onChangeText={setNewTitle} />
          <TextInput style={{ width: 100, backgroundColor: '#1A1A1A', color: '#00FF00', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#333' }} placeholder="分类(选填)" placeholderTextColor="#666" value={newCategory} onChangeText={setNewCategory} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <TextInput style={{ flex: 1, backgroundColor: '#1A1A1A', color: '#FFF', padding: 12, borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: '#333' }} placeholder="粘贴 URL (如: https://...)" placeholderTextColor="#666" value={newUrl} onChangeText={setNewUrl} keyboardType="url" autoCapitalize="none" />
          <TouchableOpacity onPress={saveBookmark} style={{ backgroundColor: '#00FF00', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 8 }}>
            <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>+ 封存</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 🏷️ 动态分类过滤器 (横向滚动) */}
      <View style={{ paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333', marginBottom: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {categories.map((cat, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => setActiveCategory(cat)}
              style={{
                marginRight: 10,
                paddingHorizontal: 15,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: activeCategory === cat ? '#00FF00' : '#1A1A1A',
                borderWidth: 1,
                borderColor: activeCategory === cat ? '#00FF00' : '#333'
              }}>
              <Text style={{ color: activeCategory === cat ? '#000' : '#FFF', fontWeight: 'bold' }}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 📋 书签列表区 */}
      <FlatList
        data={displayList}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        ListEmptyComponent={<Text style={{ color: '#666', textAlign: 'center', marginTop: 50 }}>这里比宇宙还空... 赶快存几个链接吧！</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openLink(item.url)} style={{ backgroundColor: '#1A1A1A', padding: 15, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#333', flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                <Text style={{ color: '#00FF00', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#00FF00', borderRadius: 4, marginRight: 10 }}>{item.category}</Text>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold', flex: 1 }} numberOfLines={1}>{item.title}</Text>
              </View>
              <Text style={{ color: '#888', fontSize: 13 }} numberOfLines={1}>{item.url}</Text>
            </View>
            <TouchableOpacity onPress={() => deleteBookmark(item.id)} style={{ padding: 10, marginLeft: 10 }}>
              <Ionicons name="trash" size={20} color="#FF4444" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

// ----------------- 5. 个人收件箱 (邮件 + Syncthing 本地监听) -----------------
function InboxScreen() {
  const [viewMode, setViewMode] = useState('mail'); // 'mail' | 'syncthing'
  const [localFiles, setLocalFiles] = useState([]);
  const [syncDirUri, setSyncDirUri] = useState(null);

  // 安卓底层硬核操作：获取 Syncthing 文件夹的持续访问权限 (防弹版)
  const requestSyncFolder = async () => {
    try {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        setSyncDirUri(permissions.directoryUri);
        try {
          const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(permissions.directoryUri);
          setLocalFiles(files);
          Alert.alert("✅ 绑定成功", `太棒了，检测到 ${files.length} 个文件！`);
        } catch (readError) {
          // 填平安卓“空文件夹读取崩溃”的巨坑
          setLocalFiles([]);
          Alert.alert("绑定成功", "文件夹目前是空的，快去电脑上丢个文件进来测试吧！");
        }
      }
    } catch (e) {
      // 把真实的系统报错完完整整地打印出来，绝不瞎猜！
      Alert.alert("调用系统界面失败", "真实报错信息: " + String(e));
    }
  };

  const refreshFiles = async () => {
    if (syncDirUri) {
      const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(syncDirUri);
      setLocalFiles(files);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#121212', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 45 }}>
      {/* 顶部切换器 */}
      <View style={{ flexDirection: 'row', backgroundColor: '#1A1A1A', padding: 10, justifyContent: 'space-around', borderBottomWidth: 1, borderBottomColor: '#333' }}>
        <TouchableOpacity onPress={() => setViewMode('mail')} style={{ padding: 10 }}>
          <Text style={{ color: viewMode === 'mail' ? '#00FF00' : '#888', fontWeight: 'bold', fontSize: 16 }}>📧 邮箱直连</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setViewMode('syncthing')} style={{ padding: 10 }}>
          <Text style={{ color: viewMode === 'syncthing' ? '#00FF00' : '#888', fontWeight: 'bold', fontSize: 16 }}>📂 Syncthing 文档</Text>
        </TouchableOpacity>
      </View>

      {/* 模式 A：纯净 Web 邮箱直连 (防劫持版) */}
      {viewMode === 'mail' && (
        <WebView
          source={{ uri: 'https://mail.google.com/mail/mu/mp/' }}
          style={{ flex: 1, backgroundColor: '#121212' }}
          startInLoadingState={true}
          renderLoading={() => <ActivityIndicator color="#00FF00" style={{ position: 'absolute', top: '50%', left: '50%' }} />}

          /* 第一道封印：只允许 http 和 https 协议，彻底封杀 intent:// 唤醒协议 */
          originWhitelist={['http://*', 'https://*']}
          onShouldStartLoadWithRequest={(event) => {
            if (!event.url.startsWith('http')) {
              return false; // 强行拦截所有试图跳转 App 的行为！
            }
            return true;
          }}

          /* 第二道封印：伪装 User-Agent，告诉 Google "我只是个普通的手机浏览器，别给我推 App" */
          userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36"

          /* 第三道封印：禁止网页打开新窗口 */
          setSupportMultipleWindows={false}
        />
      )}

      {/* 模式 B：Syncthing 暗网文件列表 */}
      {viewMode === 'syncthing' && (
        <View style={{ flex: 1, padding: 20 }}>
          {!syncDirUri ? (
            <View style={{ alignItems: 'center', marginTop: 50 }}>
              <Ionicons name="folder-open" size={60} color="#666" />
              <Text style={{ color: '#FFF', marginVertical: 20, textAlign: 'center', lineHeight: 24 }}>首次使用，请绑定你的 Syncthing 手机同步目录 (例如 Documents/AI_Docs)</Text>
              <TouchableOpacity onPress={requestSyncFolder} style={{ backgroundColor: '#00FF00', padding: 15, borderRadius: 8 }}>
                <Text style={{ color: '#000', fontWeight: 'bold' }}>🔗 绑定同步文件夹</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                <Text style={{ color: '#00FF00', fontWeight: 'bold' }}>已连接本地同步目录</Text>
                <TouchableOpacity onPress={refreshFiles}><Ionicons name="refresh" size={24} color="#00FF00" /></TouchableOpacity>
              </View>
              <FlatList
                data={localFiles}
                keyExtractor={item => item}
                renderItem={({ item }) => {
                  const fileName = item.split('%2F').pop().replace(/%20/g, ' '); // 简单的 URI 解码让文件名好看点
                  return (
                    <View style={{ backgroundColor: '#1A1A1A', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#333', flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="document-text" size={24} color="#FFF" style={{ marginRight: 15 }} />
                      <Text style={{ color: '#FFF', flex: 1 }} numberOfLines={2}>{fileName}</Text>
                    </View>
                  );
                }}
                ListEmptyComponent={<Text style={{ color: '#666', textAlign: 'center', marginTop: 30 }}>文件夹空空如也，等待电脑端发货...</Text>}
              />
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ----------------- 6. 底部 Tab 导航器 (总入口) -----------------
const Tab = createBottomTabNavigator();
export default function App() {
  useEffect(() => { initDB(); }, []); // 唤醒 SQLite 数据库

  return (
    <NavigationContainer theme={DarkTheme}>
      <Tab.Navigator screenOptions={({ route }) => ({
        headerShown: false, tabBarStyle: { backgroundColor: '#000', borderTopColor: '#333' },
        tabBarActiveTintColor: '#00FF00', tabBarInactiveTintColor: '#666',
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Chat') iconName = 'chatbubbles';
          else if (route.name === 'Docs') iconName = 'card';
          else if (route.name === 'Blog') iconName = 'planet';
          else if (route.name === 'Inbox') iconName = 'mail';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}>
        <Tab.Screen name="Chat" component={ChatDrawer} options={{ title: '外脑' }} />
        <Tab.Screen name="Docs" component={DocumentScreen} options={{ title: '闪卡' }} />
        <Tab.Screen name="Blog" component={BlogScreen} options={{ title: '播客/博客' }} />
        <Tab.Screen name="Inbox" component={InboxScreen} options={{ title: '收件箱' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}