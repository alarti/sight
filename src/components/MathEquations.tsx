/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface EquationBlockProps {
  number: number;
  titleEs: string;
  titleEn: string;
  isEn: boolean;
  children: React.ReactNode;
  legendEs?: string;
  legendEn?: string;
}

export const Frac: React.FC<{ num: React.ReactNode; den: React.ReactNode }> = ({ num, den }) => (
  <span className="inline-flex flex-col items-center align-middle mx-1.5 leading-tight">
    <span className="px-1.5 pb-0.5 text-center border-b border-current">{num}</span>
    <span className="px-1.5 pt-0.5 text-center">{den}</span>
  </span>
);

export const SumLim: React.FC<{ lower: React.ReactNode; upper?: React.ReactNode }> = ({ lower, upper }) => (
  <span className="inline-flex flex-col items-center align-middle mx-1 leading-none">
    {upper && <span className="text-[10px] mb-0.5">{upper}</span>}
    <span className="text-xl font-serif leading-none">∑</span>
    <span className="text-[10px] mt-0.5">{lower}</span>
  </span>
);

export const SqrtBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-stretch align-middle mx-0.5">
    <span className="text-lg font-serif leading-none select-none self-center mr-0.5">√</span>
    <span className="border-t border-current pt-0.5 px-1">{children}</span>
  </span>
);

export const MathVar: React.FC<{ children: React.ReactNode; bold?: boolean }> = ({ children, bold }) => (
  <span className={`font-serif italic ${bold ? 'font-bold not-italic' : ''}`}>{children}</span>
);

export const EquationBlock: React.FC<EquationBlockProps> = ({
  number,
  titleEs,
  titleEn,
  isEn,
  children,
  legendEs,
  legendEn,
}) => (
  <div className="my-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] p-3.5 sm:p-4 shadow-xs">
    <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-[var(--border-hairline)]/70">
      <span className="text-[11px] font-mono font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
        {isEn ? `Equation (${number}) · ${titleEn}` : `Ecuación (${number}) · ${titleEs}`}
      </span>
      <span className="text-xs font-mono font-bold text-[var(--text-primary)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded border border-[var(--border-hairline)]">
        ({number})
      </span>
    </div>

    <div
      className="py-2.5 px-3 overflow-x-auto text-center text-[var(--text-primary)] text-sm sm:text-[15px] leading-relaxed select-text"
      style={{ fontFamily: '"Cambria Math", "STIX Two Math", "Latin Modern Math", "Times New Roman", Georgia, serif' }}
    >
      <div className="inline-flex items-center justify-center flex-wrap gap-y-2">{children}</div>
    </div>

    {(legendEs || legendEn) && (
      <div className="mt-2 pt-1.5 border-t border-[var(--border-hairline)]/50 text-[11px] text-[var(--text-muted)] font-sans leading-snug">
        <strong className="text-[var(--text-secondary)]">{isEn ? 'Where: ' : 'Donde: '}</strong>
        {isEn ? legendEn : legendEs}
      </div>
    )}
  </div>
);

/**
 * Renders the Section 1 Equations (Eq. 1 to Eq. 6):
 * Canthal Variance Propagation, 4-Point Bony Canthal Constellation, Proposition 1 Bound,
 * 5-Point Iris Chord Damping, Purkinje Glint Inpainting Centroid, and 3D Eyeball Raycasting.
 */
export const Section1Equations: React.FC<{ isEn: boolean }> = ({ isEn }) => (
  <div className="space-y-3">
    <EquationBlock
      number={1}
      isEn={isEn}
      titleEs="Propagación de Error y Ganancia de Ruido en Canto Simple"
      titleEn="Single-Canthus Error Propagation & Noise Amplification Gain"
      legendEs="W_eye ≈ 0.04 es la apertura horizontal palpebral normalizada; ||∇f|| ≈ 4000 px/unidad es la norma del Jacobiano de calibración."
      legendEn="W_eye ≈ 0.04 is the normalized horizontal palpebral fissure width; ||∇f|| ≈ 4000 px/unit is the calibration Jacobian norm."
    >
      <span>
        <MathVar>σ</MathVar>
        <sub>
          <MathVar>x̃</MathVar>
        </sub>
        <sup>2</sup> ≈{' '}
        <Frac
          num={
            <span>
              <MathVar>σ</MathVar>
              <sub>iris</sub>
              <sup>2</sup> + <MathVar>σ</MathVar>
              <sub>canthus</sub>
              <sup>2</sup>
            </span>
          }
          den={
            <span>
              <MathVar>W</MathVar>
              <sub>eye</sub>
              <sup>2</sup>
            </span>
          }
        />
        , &nbsp;&nbsp; <MathVar>G</MathVar>
        <sub>noise</sub> ={' '}
        <Frac
          num="1"
          den={
            <span>
              <MathVar>W</MathVar>
              <sub>eye</sub>
            </span>
          }
        />{' '}
        ≈ 25×, &nbsp;&nbsp; <MathVar>σ</MathVar>
        <sub>screen</sub> ≈ ‖∇<MathVar>f</MathVar>‖ · <MathVar>σ</MathVar>
        <sub>
          <MathVar>x̃</MathVar>
        </sub>
      </span>
    </EquationBlock>

    <EquationBlock
      number={2}
      isEn={isEn}
      titleEs="Constelación Cantal Orbital Ósea de 4 Puntos"
      titleEn="4-Point Bony Orbital Canthal Constellation"
      legendEs="c_0 es la comisura primaria (33/133 izq., 263/362 der.), (p_up, p_lo) el par palpebral simétrico y p_orb el tubérculo orbital óseo con pesos (0.58, 0.24, 0.18)."
      legendEn="c_0 is the primary commissure (33/133 left, 263/362 right), (p_up, p_lo) the symmetric palpebral fissure pair, and p_orb the bony orbital tubercle with weights (0.58, 0.24, 0.18)."
    >
      <span>
        <MathVar bold>C</MathVar>
        <sub>cluster</sub> ={' '}
        <Frac
          num={
            <span>
              <MathVar>w</MathVar>
              <sub>0</sub>
              <MathVar bold>c</MathVar>
              <sub>0</sub> + <MathVar>w</MathVar>
              <sub>pair</sub>
              <Frac
                num={
                  <span>
                    <MathVar bold>p</MathVar>
                    <sub>up</sub> + <MathVar bold>p</MathVar>
                    <sub>lo</sub>
                  </span>
                }
                den="2"
              />{' '}
              + <MathVar>w</MathVar>
              <sub>orb</sub>
              <MathVar bold>p</MathVar>
              <sub>orb</sub>
            </span>
          }
          den={
            <span>
              <MathVar>w</MathVar>
              <sub>0</sub> + <MathVar>w</MathVar>
              <sub>pair</sub> + <MathVar>w</MathVar>
              <sub>orb</sub>
            </span>
          }
        />{' '}
        = 0.58 <MathVar bold>c</MathVar>
        <sub>0</sub> + 0.12(<MathVar bold>p</MathVar>
        <sub>up</sub> + <MathVar bold>p</MathVar>
        <sub>lo</sub>) + 0.18 <MathVar bold>p</MathVar>
        <sub>orb</sub>
      </span>
    </EquationBlock>

    <EquationBlock
      number={3}
      isEn={isEn}
      titleEs="Proposición 1: Cota de Atenuación de Varianza del Anclaje Cantal"
      titleEn="Proposition 1: Canthal Constellation Variance Attenuation Bound"
      legendEs="Bajo correlación residual sub-píxel ρ̄_ij ≤ 0.05 entre hitos óseos adyacentes, la varianza se reduce en más de un 60.3% respecto a un único hito."
      legendEn="Under empirical sub-pixel mesh error correlation ρ̄_ij ≤ 0.05 across adjacent bony landmarks, anchor variance is reduced by >60.3% prior to Jacobian mapping."
    >
      <span>
        Var(<MathVar bold>C</MathVar>
        <sub>cluster</sub>) = <MathVar>σ</MathVar>
        <sub>0</sub>
        <sup>2</sup>{' '}
        <span className="inline-flex items-center">
          <span className="text-2xl font-normal mr-0.5">(</span>
          <SumLim lower="i=0" upper="3" /> <MathVar>w</MathVar>
          <sub>
            <MathVar>i</MathVar>
          </sub>
          <sup>2</sup> + 2 <SumLim lower="0 ≤ i < j ≤ 3" /> <MathVar>w</MathVar>
          <sub>
            <MathVar>i</MathVar>
          </sub>
          <MathVar>w</MathVar>
          <sub>
            <MathVar>j</MathVar>
          </sub>
          <MathVar>ρ</MathVar>
          <sub>
            <MathVar>ij</MathVar>
          </sub>
          <span className="text-2xl font-normal ml-0.5">)</span>
        </span>{' '}
        ≤ 0.397 <MathVar>σ</MathVar>
        <sub>0</sub>
        <sup>2</sup>
      </span>
    </EquationBlock>

    <EquationBlock
      number={4}
      isEn={isEn}
      titleEs="Estimador de Iris de 5 Puntos Consistente en Cuerda"
      titleEn="Chord-Consistent 5-Point Iris Estimator"
      legendEs="m_chord = (p_left + p_right)/2 es el punto medio horizontal del limbo (invariante a ptosis palpebral superior) y ε es la excentricidad normalizada."
      legendEn="m_chord = (p_left + p_right)/2 is the horizontal limbus chord midpoint (invariant to upper-eyelid ptosis) and ε is the normalized chord eccentricity."
    >
      <span>
        <MathVar>α</MathVar>
        <sub>center</sub>(<MathVar>ε</MathVar>) ={' '}
        <span className="inline-flex items-center mx-1">
          <span className="text-3xl font-light mr-1">{'{'}</span>
          <span className="inline-flex flex-col text-left text-xs sm:text-sm gap-1">
            <span>
              0.52, &nbsp;&nbsp; {isEn ? 'if ' : 'si '} <MathVar>ε</MathVar> ≤ 0.14
            </span>
            <span>
              max(0.25, &nbsp; 0.52 · exp(−3.5(<MathVar>ε</MathVar> − 0.14))), &nbsp;&nbsp; {isEn ? 'if ' : 'si '} <MathVar>ε</MathVar> &gt; 0.14
            </span>
          </span>
        </span>
        , &nbsp;&nbsp; <MathVar>ε</MathVar> ={' '}
        <Frac
          num={
            <span>
              ‖<MathVar bold>p</MathVar>
              <sub>center</sub> − <MathVar bold>m</MathVar>
              <sub>chord</sub>‖<sub>2</sub>
            </span>
          }
          den={
            <span>
              <MathVar>D</MathVar>
              <sub>horiz</sub>
            </span>
          }
        />
      </span>
    </EquationBlock>

    <EquationBlock
      number={5}
      isEn={isEn}
      titleEs="Centroide Fotométrico Sub-Píxel con Inpainting de 1ª Imagen de Purkinje"
      titleEn="Sub-Pixel Photometric Dark-Pupil Centroid with 1st-Purkinje Glint Inpainting"
      legendEs="L̃(x) reemplaza reflejos especulares corneales (r_E ≤ 0.42 y L ≥ P_88) por el percentil oscuro P_20 sobre la luminancia L = 0.38R + 0.50G + 0.12B; T = P_75 − 0.34(P_75 − P_10)."
      legendEn="L̃(x) inpaints corneal specular reflections (r_E ≤ 0.42 and L ≥ P_88) to the dark-pupil 20th percentile P_20 over red-weighted luminance L = 0.38R + 0.50G + 0.12B; T = P_75 − 0.34(P_75 − P_10)."
    >
      <span>
        <MathVar bold>c</MathVar>
        <sub>photo</sub> ={' '}
        <Frac
          num={
            <span>
              <SumLim lower="x ∈ E" /> max(0, <MathVar>T</MathVar> − <MathVar>L̃</MathVar>(<MathVar bold>x</MathVar>))<sup>2</sup> · exp(−1.15 <MathVar>r</MathVar>
              <sub>E</sub>
              <sup>2</sup>(<MathVar bold>x</MathVar>)) · <MathVar bold>x</MathVar>
            </span>
          }
          den={
            <span>
              <SumLim lower="x ∈ E" /> max(0, <MathVar>T</MathVar> − <MathVar>L̃</MathVar>(<MathVar bold>x</MathVar>))<sup>2</sup> · exp(−1.15 <MathVar>r</MathVar>
              <sub>E</sub>
              <sup>2</sup>(<MathVar bold>x</MathVar>)) + <MathVar>ε</MathVar>
            </span>
          }
        />
      </span>
    </EquationBlock>

    <EquationBlock
      number={6}
      isEn={isEn}
      titleEs="Raycasting 3D de Eje Óptico sobre Globo Ocular Esférico"
      titleEn="3D Spherical Eyeball Optical-Axis Raycasting"
      legendEs="O_eye sitúa el centro anatómico de rotación ocular 12 mm por detrás del plano cantal M_canthus a lo largo del vector craneal anteroposterior e_z."
      legendEn="O_eye anchors the anatomical eyeball rotation center 12 mm posterior to the canthal midpoint M_canthus along the cranial anteroposterior axis e_z."
    >
      <span>
        <MathVar bold>O</MathVar>
        <sub>eye</sub> = <MathVar bold>M</MathVar>
        <sub>canthus</sub> − 0.44 <MathVar>W</MathVar>
        <sub>eye</sub>
        <sup>3D</sup> <MathVar bold>e</MathVar>
        <sub>z</sub>, &nbsp;&nbsp;&nbsp; <MathVar bold>d</MathVar>
        <sub>ray</sub> ={' '}
        <Frac
          num={
            <span>
              <MathVar bold>P</MathVar>
              <sub>pupil</sub>
              <sup>3D</sup> − <MathVar bold>O</MathVar>
              <sub>eye</sub>
            </span>
          }
          den={
            <span>
              ‖<MathVar bold>P</MathVar>
              <sub>pupil</sub>
              <sup>3D</sup> − <MathVar bold>O</MathVar>
              <sub>eye</sub>‖<sub>2</sub>
            </span>
          }
        />
      </span>
    </EquationBlock>
  </div>
);

/**
 * Renders Section 2 Equations (Eq. 7 to Eq. 10):
 * Hering Binocular Conjugate Coherence, 1€ Filter, Cubic-Sigmoid Kalman Filter, and Dual Fixation Lock.
 */
export const Section2Equations: React.FC<{ isEn: boolean }> = ({ isEn }) => (
  <div className="space-y-3">
    <EquationBlock
      number={7}
      isEn={isEn}
      titleEs="Puerta de Coherencia Binocular Conjugada (Ley de Hering) y Pre-Filtro Recortado"
      titleEn="Hering's Law Binocular Conjugate Coherence Gate & 5-Tap Trimmed Pre-Filter"
      legendEs="Δg_L y Δg_R son los desplazamientos inter-fotograma de ambos ojos; las sacadas reales verifican cos θ_LR → +1, mientras que el ruido monocular es incorrelado."
      legendEn="Δg_L and Δg_R are inter-frame displacements of the left and right eyes; true version movements satisfy cos θ_LR → +1, whereas monocular sensor noise is uncorrelated."
    >
      <span>
        <MathVar>C</MathVar>
        <sub>binoc</sub> = clip
        <span className="inline-flex items-center">
          <span className="text-2xl font-normal">(</span>
          <Frac
            num={
              <span>
                <Frac
                  num={
                    <span>
                      Δ<MathVar bold>g</MathVar>
                      <sub>L</sub> · Δ<MathVar bold>g</MathVar>
                      <sub>R</sub>
                    </span>
                  }
                  den={
                    <span>
                      ‖Δ<MathVar bold>g</MathVar>
                      <sub>L</sub>‖<sub>2</sub> ‖Δ<MathVar bold>g</MathVar>
                      <sub>R</sub>‖<sub>2</sub> + <MathVar>ε</MathVar>
                    </span>
                  }
                />{' '}
                + 0.35
              </span>
            }
            den="1.15"
          />
          , &nbsp; 0.18, &nbsp; 1.0
          <span className="text-2xl font-normal">)</span>
        </span>
        , &nbsp;&nbsp; <MathVar>g̅</MathVar>
        <sub>trim</sub> ={' '}
        <Frac
          num={
            <span>
              <SumLim lower="k=1" upper="5" /> <MathVar>g</MathVar>
              <sub>k</sub> − min <MathVar>g</MathVar>
              <sub>k</sub> − max <MathVar>g</MathVar>
              <sub>k</sub>
            </span>
          }
          den="3"
        />
      </span>
    </EquationBlock>

    <EquationBlock
      number={8}
      isEn={isEn}
      titleEs="Filtro Paso-Bajo Adaptativo en Velocidad 1€"
      titleEn="Speed-Adaptive 1€ Low-Pass Filter"
      legendEs="f_{c,min} = 0.36 Hz suprime el temblor de reposo y β = 4.2 eleva la frecuencia de corte instantáneamente durante sacadas rápidas."
      legendEn="f_{c,min} = 0.36 Hz suppresses resting tremor while β = 4.2 raises the cutoff frequency instantaneously during rapid saccades."
    >
      <span>
        <MathVar>f</MathVar>
        <sub>c</sub>(<MathVar>t</MathVar>) = <MathVar>f</MathVar>
        <sub>c,min</sub> + <MathVar>β</MathVar> · ‖<MathVar bold>ġ</MathVar>(<MathVar>t</MathVar>)‖<sub>2</sub>, &nbsp;&nbsp;&nbsp; <MathVar>α</MathVar>
        <sub>1€</sub>(<MathVar>t</MathVar>) ={' '}
        <Frac
          num="1"
          den={
            <span>
              1 +{' '}
              <Frac
                num="1"
                den={
                  <span>
                    2π <MathVar>f</MathVar>
                    <sub>c</sub>(<MathVar>t</MathVar>) Δ<MathVar>t</MathVar>
                  </span>
                }
              />
            </span>
          }
        />
      </span>
    </EquationBlock>

    <EquationBlock
      number={9}
      isEn={isEn}
      titleEs="Filtro de Kalman de Mahalanobis con Puerta de Innovación Sigmoidea-Cúbica"
      titleEn="Cubic-Sigmoid Mahalanobis Innovation-Gated Kalman Filter"
      legendEs="d_innov = ‖z_k − x̂_{k|k-1}‖_2 es la distancia de innovación en píxeles y s(t) = 3t² − 2t³ es el polinomio hermítico C¹ con t = clip((d_innov − 22)/42, 0, 1)."
      legendEn="d_innov = ‖z_k − x̂_{k|k-1}‖_2 is the screen-space innovation norm and s(t) = 3t² − 2t³ is the C¹ cubic Hermite sigmoid with t = clip((d_innov − 22)/42, 0, 1)."
    >
      <span>
        <MathVar>R</MathVar>
        <sub>k</sub>(<MathVar>d</MathVar>
        <sub>innov</sub>) ={' '}
        <span className="inline-flex items-center mx-1">
          <span className="text-3xl font-light mr-1">{'{'}</span>
          <span className="inline-flex flex-col text-left text-xs sm:text-sm gap-0.5">
            <span>
              26.0, &nbsp;&nbsp; <MathVar>d</MathVar>
              <sub>innov</sub> ≤ 22 px
            </span>
            <span>
              26.0(1 − <MathVar>s</MathVar>(<MathVar>t</MathVar>)) + 1.4 <MathVar>s</MathVar>(<MathVar>t</MathVar>), &nbsp;&nbsp; 22 &lt; <MathVar>d</MathVar>
              <sub>innov</sub> ≤ 64 px
            </span>
            <span>
              0.22, &nbsp;&nbsp; <MathVar>d</MathVar>
              <sub>innov</sub> &gt; 64 px
            </span>
          </span>
        </span>
        , &nbsp;&nbsp; <MathVar>s</MathVar>(<MathVar>t</MathVar>) = 3<MathVar>t</MathVar>
        <sup>2</sup> − 2<MathVar>t</MathVar>
        <sup>3</sup>
      </span>
    </EquationBlock>

    <EquationBlock
      number={10}
      isEn={isEn}
      titleEs="Bloqueo de Fijación Concéntrico Dual con Histéresis"
      titleEn="Dual-Concentric Hysteresis Fixation Lock"
      legendEs="Retiene el 96% del anclaje foveal dentro de 14 px (eliminando el temblor durante la selección por dwell) y libera con latencia cero en sacadas ≥ 64 px."
      legendEn="Retains 96% of the foveal anchor within 14 px (eliminating cursor tremor during dwell selection) and releases with zero latency on saccades ≥ 64 px."
    >
      <span>
        <MathVar bold>a</MathVar>
        <sub>k</sub> = (1 − <MathVar>α</MathVar>
        <sub>lock</sub>)<MathVar bold>a</MathVar>
        <sub>k−1</sub> + <MathVar>α</MathVar>
        <sub>lock</sub>
        <MathVar bold>x̂</MathVar>
        <sub>k</sub>, &nbsp;&nbsp; <MathVar>α</MathVar>
        <sub>lock</sub>(<MathVar>d</MathVar>) ={' '}
        <span className="inline-flex items-center mx-1">
          <span className="text-3xl font-light mr-1">{'{'}</span>
          <span className="inline-flex flex-col text-left text-xs sm:text-sm gap-0.5">
            <span>0.04 &nbsp; (96% lock), &nbsp; d &lt; 14 px</span>
            <span>0.12 &nbsp; (88% lock), &nbsp; 14 ≤ d &lt; 28 px</span>
            <span>
              0.14 + 0.56((<MathVar>d</MathVar> − 28)/36)<sup>2</sup>, &nbsp; 28 ≤ d &lt; 64 px
            </span>
            <span>1.00 &nbsp; (0 ms snap), &nbsp; d ≥ 64 px</span>
          </span>
        </span>
      </span>
    </EquationBlock>
  </div>
);

/**
 * Renders Section 3 Equations (Eq. 11 to Eq. 14):
 * M-QPM Hybrid Homography + TPS, Huber IRLS Bivariate Ridge, Closed-Form Hat-Matrix LOOCV, and OrbitoGaze Lag Cross-Correlation.
 */
export const Section3Equations: React.FC<{ isEn: boolean }> = ({ isEn }) => (
  <div className="space-y-3">
    <EquationBlock
      number={11}
      isEn={isEn}
      titleEs=" Superficie Híbrida M-QPM (Homografía de Hartley + Campo Residual Thin-Plate Spline Blanqueado)"
      titleEn="M-QPM Hybrid Surface (Hartley Projective Homography + Whitened Thin-Plate Spline Field)"
      legendEs="u = ((x − μ_x)/σ_x, (y − μ_y)/σ_y) son las coordenadas pupilares blanqueadas por Mahalanobis y τ_hull(u) la atenuación exterior tanh C¹."
      legendEn="u = ((x − μ_x)/σ_x, (y − μ_y)/σ_y) are Mahalanobis-whitened pupil coordinates and τ_hull(u) is the exterior convex-hull C¹ tanh plateau attenuation."
    >
      <span>
        <MathVar bold>g</MathVar>
        <sub>M-QPM</sub>(<MathVar bold>u</MathVar>) = <MathVar>P</MathVar>
        <sub>
          <MathVar bold>H</MathVar>
        </sub>
        (<MathVar bold>u</MathVar>) + <MathVar>τ</MathVar>
        <sub>hull</sub>(<MathVar bold>u</MathVar>) <SumLim lower="i=1" upper="N" /> <MathVar bold>w</MathVar>
        <sub>
          <MathVar>i</MathVar>
        </sub>{' '}
        ‖<MathVar bold>u</MathVar> − <MathVar bold>c</MathVar>
        <sub>
          <MathVar>i</MathVar>
        </sub>
        ‖<sub>2</sub>
        <sup>2</sup> ln(‖<MathVar bold>u</MathVar> − <MathVar bold>c</MathVar>
        <sub>
          <MathVar>i</MathVar>
        </sub>
        ‖<sub>2</sub> + <MathVar>ε</MathVar>)
      </span>
    </EquationBlock>

    <EquationBlock
      number={12}
      isEn={isEn}
      titleEs="Regresión Polinómica Bivariada Ridge con Reponderación IRLS de Huber (SVD de Golub-Kahan)"
      titleEn="2-Pass Huber IRLS Bivariate Polynomial Ridge Regression (Golub-Kahan SVD)"
      legendEs="ϕ(v) ∈ R^10 acopla términos cuadráticos pupilares (X̃, Ỹ) con compensación de pose cefálica (ψ, θ); W_Huber atenúa outliers con umbral δ = 1.345·MAD."
      legendEn="ϕ(v) ∈ R^10 couples quadratic pupil terms (X̃, Ỹ) with 3D head-pose compensation (ψ, θ); W_Huber downweights outliers with threshold δ = 1.345·MAD."
    >
      <div className="flex flex-col items-center gap-2">
        <span>
          <MathVar bold>W</MathVar>
          <sup>*</sup> = (<MathVar bold>Φ</MathVar>
          <sup>T</sup> <MathVar bold>W</MathVar>
          <sub>Huber</sub> <MathVar bold>Φ</MathVar> + <MathVar>λ</MathVar> <MathVar bold>Γ</MathVar>)<sup>−1</sup> <MathVar bold>Φ</MathVar>
          <sup>T</sup> <MathVar bold>W</MathVar>
          <sub>Huber</sub> <MathVar bold>Y</MathVar>
        </span>
        <span className="text-xs sm:text-sm">
          <MathVar bold>ϕ</MathVar>(<MathVar bold>v</MathVar>) = [ 1, &nbsp; <MathVar>X̃</MathVar>, &nbsp; <MathVar>Ỹ</MathVar>, &nbsp; <MathVar>X̃Ỹ</MathVar>, &nbsp;{' '}
          <MathVar>X̃</MathVar>
          <sup>2</sup>, &nbsp; <MathVar>Ỹ</MathVar>
          <sup>2</sup>, &nbsp; <MathVar>ψ</MathVar>, &nbsp; <MathVar>θ</MathVar>, &nbsp; <MathVar>X̃ψ</MathVar>, &nbsp; <MathVar>Ỹθ</MathVar> ]<sup>T</sup>
        </span>
      </div>
    </EquationBlock>

    <EquationBlock
      number={13}
      isEn={isEn}
      titleEs="Validación Cruzada Exacta Leave-One-Out (LOOCV) por Matriz Sombrero"
      titleEn="Exact Closed-Form Leverage Hat-Matrix Leave-One-Out Cross-Validation (LOOCV)"
      legendEs="Evalúa el error exacto de generalización en O(N) mediante la diagonal de apalancamiento H_ii sin reentrenar N modelos."
      legendEn="Evaluates exact generalization error in O(N) via the leverage diagonal H_ii without refitting N separate models."
    >
      <span>
        RMSE<sub>LOOCV</sub> ={' '}
        <SqrtBox>
          <Frac num="1" den={<MathVar>N</MathVar>} /> <SumLim lower="i=1" upper="N" />{' '}
          <span className="inline-flex items-center">
            ‖
            <Frac
              num={
                <span>
                  <MathVar bold>y</MathVar>
                  <sub>
                    <MathVar>i</MathVar>
                  </sub>{' '}
                  − <MathVar bold>ŷ</MathVar>
                  <sub>
                    <MathVar>i</MathVar>
                  </sub>
                </span>
              }
              den={
                <span>
                  1 − <MathVar>H</MathVar>
                  <sub>
                    <MathVar>ii</MathVar>
                  </sub>
                </span>
              }
            />
            ‖<sub>2</sub>
            <sup>2</sup>
          </span>
        </SqrtBox>
        , &nbsp;&nbsp; <MathVar bold>H</MathVar> = <MathVar bold>Φ</MathVar>(<MathVar bold>Φ</MathVar>
        <sup>T</sup> <MathVar bold>W</MathVar>
        <sub>Huber</sub> <MathVar bold>Φ</MathVar> + <MathVar>λ</MathVar>
        <MathVar bold>Γ</MathVar>)<sup>−1</sup>
        <MathVar bold>Φ</MathVar>
        <sup>T</sup> <MathVar bold>W</MathVar>
        <sub>Huber</sub>
      </span>
    </EquationBlock>

    <EquationBlock
      number={14}
      isEn={isEn}
      titleEs="Recuperación de Latencia Fisiológica Oculomotora en OrbitoGaze (Correlación Cruzada)"
      titleEn="OrbitoGaze Oculomotor Pursuit Latency Recovery via Cross-Correlation"
      legendEs="Estima el retardo fisiológico τ* ∈ [0, 260 ms] entre el estímulo orbital de Lissajous s(t) y la traza ocular g(t) antes de podar sacadas vía 2.2×MAD."
      legendEn="Recovers the patient's physiological pursuit delay τ* ∈ [0, 260 ms] between the Lissajous stimulus s(t) and gaze trace g(t) prior to 2.2×MAD saccade pruning."
    >
      <span>
        <MathVar>τ</MathVar>
        <sup>*</sup> = arg max<sub>τ ∈ [0, 260 ms]</sub>{' '}
        <span className="inline-flex items-center">
          <span className="text-2xl font-normal">[</span>
          <Frac
            num={
              <span>
                Cov(<MathVar>g</MathVar>
                <sub>x</sub>(<MathVar>t</MathVar>), <MathVar>s</MathVar>
                <sub>x</sub>(<MathVar>t</MathVar> − <MathVar>τ</MathVar>))
              </span>
            }
            den={
              <span>
                <MathVar>σ</MathVar>
                <sub>
                  <MathVar>g</MathVar>
                  <sub>x</sub>
                </sub>{' '}
                <MathVar>σ</MathVar>
                <sub>
                  <MathVar>s</MathVar>
                  <sub>x</sub>
                </sub>
              </span>
            }
          />{' '}
          +{' '}
          <Frac
            num={
              <span>
                Cov(<MathVar>g</MathVar>
                <sub>y</sub>(<MathVar>t</MathVar>), <MathVar>s</MathVar>
                <sub>y</sub>(<MathVar>t</MathVar> − <MathVar>τ</MathVar>))
              </span>
            }
            den={
              <span>
                <MathVar>σ</MathVar>
                <sub>
                  <MathVar>g</MathVar>
                  <sub>y</sub>
                </sub>{' '}
                <MathVar>σ</MathVar>
                <sub>
                  <MathVar>s</MathVar>
                  <sub>y</sub>
                </sub>
              </span>
            }
          />
          <span className="text-2xl font-normal">]</span>
        </span>
      </span>
    </EquationBlock>
  </div>
);

/**
 * Renders Section 4 Equations (Eq. 15 and Eq. 16):
 * Sequential Bayesian Target Decoder, LPC-16 Vocal Tract Transfer Function, and Wolpaw ITR.
 */
export const Section4Equations: React.FC<{ isEn: boolean }> = ({ isEn }) => (
  <div className="space-y-3">
    <EquationBlock
      number={15}
      isEn={isEn}
      titleEs="Decodificador Bayesiano Secuencial de Objetivos con Verosimilitud Anisótropa"
      titleEn="Sequential Bayesian Target Decoder with Anisotropic Gaussian Likelihood"
      legendEs="σ_Y = 40 px > σ_X = 28 px acomoda la varianza vertical palpebral; γ = 0.86 es el factor de olvido temporal sobre el conjunto de botones T."
      legendEn="σ_Y = 40 px > σ_X = 28 px accommodates vertical palpebral variance; γ = 0.86 is the temporal forgetting factor across interactive targets T."
    >
      <span>
        <MathVar>ℓ</MathVar>
        <sub>
          <MathVar>i</MathVar>
        </sub>
        (<MathVar>t</MathVar>) = <MathVar>γ</MathVar> <MathVar>ℓ</MathVar>
        <sub>
          <MathVar>i</MathVar>
        </sub>
        (<MathVar>t</MathVar> − 1) −{' '}
        <Frac
          num={
            <span>
              (<MathVar>g</MathVar>
              <sub>x,t</sub> − <MathVar>μ</MathVar>
              <sub>i,x</sub>)<sup>2</sup>
            </span>
          }
          den={
            <span>
              2<MathVar>σ</MathVar>
              <sub>X</sub>
              <sup>2</sup>
            </span>
          }
        />{' '}
        −{' '}
        <Frac
          num={
            <span>
              (<MathVar>g</MathVar>
              <sub>y,t</sub> − <MathVar>μ</MathVar>
              <sub>i,y</sub>)<sup>2</sup>
            </span>
          }
          den={
            <span>
              2<MathVar>σ</MathVar>
              <sub>Y</sub>
              <sup>2</sup>
            </span>
          }
        />
        , &nbsp;&nbsp;&nbsp; <MathVar>P</MathVar>(<MathVar>T</MathVar>
        <sub>
          <MathVar>i</MathVar>
        </sub>{' '}
        | <MathVar bold>g</MathVar>
        <sub>1:t</sub>) ={' '}
        <Frac
          num={
            <span>
              exp(<MathVar>ℓ</MathVar>
              <sub>
                <MathVar>i</MathVar>
              </sub>
              (<MathVar>t</MathVar>))
            </span>
          }
          den={
            <span>
              <SumLim lower="j ∈ T" /> exp(<MathVar>ℓ</MathVar>
              <sub>
                <MathVar>j</MathVar>
              </sub>
              (<MathVar>t</MathVar>))
            </span>
          }
        />
      </span>
    </EquationBlock>

    <EquationBlock
      number={16}
      isEn={isEn}
      titleEs="Filtro Todo-Polos LPC-16 de Tracto Vocal y Tasa de Transferencia de Información (Wolpaw ITR)"
      titleEn="16th-Order All-Pole LPC Vocal Tract Filter & Wolpaw Information Transfer Rate (ITR)"
      legendEs="Los coeficientes {a_k} se resuelven por Levinson-Durbin con estabilidad de polos |z_k| ≤ 0.985; ITR mide bits/min sobre M = 36 objetivos con precisión P."
      legendEn="Predictor coefficients {a_k} are solved via Levinson-Durbin with pole-radius stability |z_k| ≤ 0.985; ITR measures bits/min across M = 36 targets with accuracy P."
    >
      <span>
        <MathVar>H</MathVar>
        <sub>LPC</sub>(<MathVar>z</MathVar>) ={' '}
        <Frac
          num={<MathVar>G</MathVar>}
          den={
            <span>
              1 − <SumLim lower="k=1" upper="16" /> <MathVar>a</MathVar>
              <sub>
                <MathVar>k</MathVar>
              </sub>{' '}
              <MathVar>z</MathVar>
              <sup>
                −<MathVar>k</MathVar>
              </sup>
            </span>
          }
        />
        , &nbsp;&nbsp;&nbsp; ITR ={' '}
        <Frac
          num="60"
          den={
            <span>
              <MathVar>T</MathVar>
              <sub>sel</sub>
            </span>
          }
        />{' '}
        <span className="inline-flex items-center">
          [ log<sub>2</sub> <MathVar>M</MathVar> + <MathVar>P</MathVar> log<sub>2</sub> <MathVar>P</MathVar> + (1 − <MathVar>P</MathVar>) log<sub>2</sub>{' '}
          <Frac
            num={
              <span>
                1 − <MathVar>P</MathVar>
              </span>
            }
            den={
              <span>
                <MathVar>M</MathVar> − 1
              </span>
            }
          />{' '}
          ]
        </span>
      </span>
    </EquationBlock>
  </div>
);
