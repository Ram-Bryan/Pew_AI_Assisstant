import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function Button() {

    const [count, setCount] = useState(0);

    return (
        <View>

            <Text>{count}</Text>

            {count <= 0 && <Text>You cant go negative !</Text>}

            <Pressable onPress={() => setCount(count + 1)} className="bg-red-500 px-6 py-3 rounded-lg disabled:bg-gray-300">
                <Text>Increase</Text>
            </Pressable>

            <Pressable disabled={count == 0} onPress={() => setCount(count - 1) } className="bg-red-500 px-6 py-3 rounded-lg disabled:bg-gray-300">
                <Text>Descrease</Text>
            </Pressable>

        </View>
    )
}
