import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        color: focused ? '#38bdf8' : '#7f95ad',
        fontSize: 12,
        fontWeight: '800',
      }}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#08111f' },
        headerTintColor: '#f8fafc',
        headerTitleStyle: { fontWeight: '800' },
        tabBarActiveTintColor: '#38bdf8',
        tabBarInactiveTintColor: '#7f95ad',
        tabBarStyle: {
          height: 64,
          borderTopColor: '#18314f',
          backgroundColor: '#091426',
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Home" />,
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: 'Practice',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Drill" />,
        }}
      />
      <Tabs.Screen
        name="graph"
        options={{
          title: 'Knowledge Map',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Map" />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Notes" />,
        }}
      />
    </Tabs>
  );
}
