export function shortenAddress(address: string): string {
  return address.slice(0, 5) + '...' + address.slice(-4);
}

export function calculateAge(creationTime: number): string {
  const currentTime = Date.now();
  const ageInMilliseconds = currentTime - creationTime * 1000; // Convert creationTime to milliseconds
  const ageInSeconds = Math.floor(ageInMilliseconds / 1000);

  // Calculate days, hours, minutes, and seconds
  const days = Math.floor(ageInSeconds / (3600 * 24));
  const hours = Math.floor((ageInSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((ageInSeconds % 3600) / 60);
  const seconds = ageInSeconds % 60;

  let ageString = '';
  if (days > 0) {
    ageString += `${days}d `;
  }
  if (hours > 0) {
    ageString += `${hours}h `;
  }
  if (minutes > 0) {
    ageString += `${minutes}m `;
  }
  if (seconds > 0) {
    ageString += `${seconds}s`;
  }

  return ageString.trim(); // Trim any trailing whitespace
}

export function formatLargeNumber(value: number): string {
  const suffixes = ['', 'K', 'M', 'B', 'T']; // Add more suffixes if needed
  const suffixIndex = Math.floor(Math.log10(Math.abs(value)) / 3);
  const scaledValue = value / Math.pow(10, suffixIndex * 3);
  const formattedValue = scaledValue.toFixed(2);
  return formattedValue + suffixes[suffixIndex];
}
