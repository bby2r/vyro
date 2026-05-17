import { Redirect } from 'expo-router';

export default function ExpensesIndex() {
  return <Redirect href="/(tabs)/expenses/form" />;
}
