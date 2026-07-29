import { View, Pressable, Text } from "react-native";

export default function CalculatorScreen(){
    return (
        <View>

            <Pressable>
                <Text>+</Text>
            </Pressable>
            <Pressable>
                <Text>-</Text>
            </Pressable>
            <Pressable>
                <Text>×</Text>
            </Pressable>
            <Pressable>
                <Text>÷</Text>
            </Pressable>    
        </View>
    )
}