import { StyleSheet, Text, View } from 'react-native';

export default function DiscoverScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Discover Courses</Text>
      <Text style={styles.subtitle}>Find tee times that match your mood</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1a7f4b', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center' },
});
