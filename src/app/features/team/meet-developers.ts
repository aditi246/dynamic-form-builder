import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type TeamMember = {
  name: string;
  title: string;
  bio: string;
  linkedin: string;
  avatar?: string;
  accent: string;
  focus: string;
  isAI?: boolean;
};

@Component({
  selector: 'app-meet-developers',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './meet-developers.html',
  styleUrl: './meet-developers.scss',
})
export class MeetDevelopersComponent {
  readonly members: TeamMember[] = [
    {
      name: 'Achal Utkarsh',
      title: 'Lead UI Developer',
      bio: 'Project idea owner; shaped the validation model and overall form concept.',
      linkedin: 'https://www.linkedin.com/in/achal-utkarsh-516733113/',
      avatar:
        'https://media.licdn.com/dms/image/v2/C5103AQE6baEm8Aiqmw/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1567525867022?e=1766620800&v=beta&t=jwlAS50e9iOsKpPbCFCyhBKlWiZFcjM5L90nui89T5I',
      accent: 'linear-gradient(135deg, #2563eb, #22d3ee)',
      focus: 'Vision',
    },
    {
      name: 'Aditi Joshi',
      title: 'Senior UI Developer',
      bio: 'Championed AI-powered previews and the smart review pass on the preview page.',
      linkedin: 'https://www.linkedin.com/in/aditi-joshi-dev/',
      avatar:
        'https://media.licdn.com/dms/image/v2/D5603AQFCmkE5QlqdFg/profile-displayphoto-shrink_400_400/B56ZYQ9v8lHEAg-/0/1744041348998?e=1766620800&v=beta&t=mguZhJkp3iPI-YCazP8gyh3F9WigX2GRs14dNPeNHks',
      accent: 'linear-gradient(135deg, #ec4899, #a855f7)',
      focus: 'AI features',
    },
    {
      name: 'Alka Vats',
      title: 'Senior UI Developer',
      bio: 'Built key flows and kept the crew shipping clean, production-ready code.',
      linkedin: 'https://www.linkedin.com/in/alka-vats-78575a191/',
      avatar:
        'https://media.licdn.com/dms/image/v2/D5603AQEqH764Q9L5FA/profile-displayphoto-scale_400_400/B56ZrlMtK_HQAk-/0/1764781906786?e=1766620800&v=beta&t=GA-hu-3DURaxpXSOr24WNRptyeFSNJEriqZiEHl4ofQ',
      accent: 'linear-gradient(135deg, #0ea5e9, #10b981)',
      focus: 'Delivery',
    },
    {
      name: 'Codex',
      title: 'ChatGPT · AI co-builder',
      bio: 'Pairing on UX, components, and docs so the crew can ship faster than the brief.',
      linkedin: '',
      accent: 'linear-gradient(135deg, #7c3aed, #22d3ee)',
      focus: 'Velocity',
      isAI: true,
    },
  ];

  readonly highlights = [
    'Realtime validation lab',
    'Rule-driven builder',
    'Design x engineering pairing',
  ];
}
