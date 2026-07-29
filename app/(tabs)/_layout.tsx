import { Tabs } from "expo-router";

export default function HomeScreen() {
    return (
        <Tabs>
            <Tabs.Screen name="index" />
            <Tabs.Screen name="increase" />
            <Tabs.Screen name="tdl" />
        </Tabs>
    )
}