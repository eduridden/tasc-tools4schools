
// Floating cubes background animation for hero sections.
// Each cube has a unique size, horizontal position, delay, and duration
// to create a natural, staggered rising effect.

const CUBES: Array<{
  size: number;
  left: string;
  delay: number;
  duration: number;
}> = [
  { size: 40,  left: '5%',   delay: 0,    duration: 9  },
  { size: 20,  left: '12%',  delay: 2.5,  duration: 12 },
  { size: 60,  left: '20%',  delay: 5,    duration: 8  },
  { size: 30,  left: '28%',  delay: 1,    duration: 14 },
  { size: 80,  left: '36%',  delay: 3.5,  duration: 10 },
  { size: 25,  left: '45%',  delay: 7,    duration: 11 },
  { size: 50,  left: '52%',  delay: 0.5,  duration: 13 },
  { size: 35,  left: '60%',  delay: 4,    duration: 9  },
  { size: 70,  left: '68%',  delay: 6,    duration: 12 },
  { size: 20,  left: '75%',  delay: 2,    duration: 15 },
  { size: 45,  left: '82%',  delay: 8,    duration: 10 },
  { size: 55,  left: '88%',  delay: 1.5,  duration: 8  },
  { size: 30,  left: '93%',  delay: 4.5,  duration: 13 },
  { size: 65,  left: '48%',  delay: 9,    duration: 11 },
  { size: 22,  left: '16%',  delay: 6.5,  duration: 14 },
];

export function FloatingCubes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {CUBES.map((cube, i) => (
        <div
          key={i}
          className="floating-cube"
          style={{
            width:           cube.size,
            height:          cube.size,
            left:            cube.left,
            animationDelay:  `${cube.delay}s`,
            animationDuration: `${cube.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
