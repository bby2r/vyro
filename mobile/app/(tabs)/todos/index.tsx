import { Redirect } from 'expo-router';

export default function TodosIndex() {
  return <Redirect href="/(tabs)/todos/form" />;
}
