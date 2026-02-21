export const INITIAL_MODULES = [
  {
    id: 1,
    title: 'Psychological Tactics',
    description: 'Learn to identify manipulation techniques',
    progress: 85,
    rating: 4.8,
    icon: 'Brain'
  },
  {
    id: 2,
    title: 'BiTB Awareness',
    description: 'Browser-in-the-Browser attack detection',
    progress: 60,
    rating: 4.8,
    icon: 'Shield'
  },
  {
    id: 3,
    title: 'Deceptive Links 101',
    description: 'Spot malicious URLs and domains',
    progress: 92,
    rating: 4.8,
    icon: 'Link'
  },
  {
    id: 4,
    title: 'Email Security',
    description: 'Advanced email threat recognition',
    progress: 45,
    rating: 4.8,
    icon: 'Mail'
  }
];

export const INITIAL_SIMULATIONS = [
  { id: 1, title: 'Psychological Tactics', description: 'Learn to identify manipulation techniques', progress: 0, rating: 4.8, icon: 'Brain' },
  { id: 2, title: 'BiTB Awareness', description: 'Browser-in-the-Browser attack detection', progress: 0, rating: 4.8, icon: 'Shield' },
  { id: 3, title: 'Deceptive Links 101', description: 'Spot malicious URLs and domains', progress: 0, rating: 4.8, icon: 'Link' },
  { id: 4, title: 'Credential Harvesting', description: 'Learn to identify manipulation techniques', progress: 0, rating: 4.6, icon: 'Brain' },
  { id: 5, title: 'Spear Phishing', description: 'Learn to Spot Targeted Impersonation', progress: 0, rating: 3.3, icon: 'Shield' },
  { id: 6, title: 'Drive-by-Downloads', description: 'Learn to Recognize Malicious Web Redirections', progress: 0, rating: 5.0, icon: 'Link' },
  { id: 7, title: 'Quishing Tactics', description: 'QR Code attack detection', progress: 0, rating: 4.9, icon: 'Brain' },
  { id: 8, title: 'Vishing Tactics', description: 'Learn to hear the Voice-attack scripts', progress: 0, rating: 4.1, icon: 'Shield' },
  { id: 9, title: 'Watering Hole Attack', description: 'Learn to Identify Compromised Websites', progress: 0, rating: 3.9, icon: 'Link' }
];

export const MOCK_USER = {
  name: 'Alex Johnson',
  email: 'alex.johnson@company.com',
  resilienceScore: 78,
  stats: {
    simulationsCompleted: 24,
    phishDetected: 18,
    modulesFinished: 7
  }
};
